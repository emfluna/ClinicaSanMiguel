import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createServer as createViteServer } from "vite";
import webpush from "web-push";
import fs from "fs";
import crypto from "crypto";
import { supabase } from "./services/supabaseClient";

const app = express();
const PORT = 3000;

// Parse request body with generous limit for high-definition clinical images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ==============================================================================
// CONFIGURACIÓN DE NOTIFICACIONES PUSH (WEB-PUSH)
// ==============================================================================
const VAPID_KEYS_FILE = path.join(process.cwd(), "vapid-keys.json");
const SUBSCRIPTIONS_FILE = path.join(process.cwd(), "push-subscriptions.json");

let vapidKeys: { publicKey: string; privateKey: string };

// Inicializar o leer VAPID Keys
if (fs.existsSync(VAPID_KEYS_FILE)) {
  try {
    vapidKeys = JSON.parse(fs.readFileSync(VAPID_KEYS_FILE, "utf8"));
  } catch (e) {
    console.error("Error al leer vapid-keys.json, generando nuevas claves...");
    vapidKeys = webpush.generateVAPIDKeys();
    fs.writeFileSync(VAPID_KEYS_FILE, JSON.stringify(vapidKeys, null, 2), "utf8");
  }
} else {
  vapidKeys = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_KEYS_FILE, JSON.stringify(vapidKeys, null, 2), "utf8");
}

// Configurar detalles VAPID con el email del doctor/administrador
webpush.setVapidDetails(
  "mailto:Emf.Luna@gmail.com",
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

interface SavedSubscription {
  subscription: webpush.PushSubscription;
  timezoneOffset: number; // en minutos (ej: 300 para Perú que es UTC-5)
  registeredAt: string;
}

// Obtener lista de suscripciones
function getSubscriptions(): SavedSubscription[] {
  if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE, "utf8"));
    } catch (e) {
      console.error("Error al leer push-subscriptions.json:", e);
      return [];
    }
  }
  return [];
}

// Guardar lista de suscripciones
function saveSubscriptions(subs: SavedSubscription[]) {
  try {
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subs, null, 2), "utf8");
  } catch (e) {
    console.error("Error al guardar push-subscriptions.json:", e);
  }
}

// ==============================================================================
// SISTEMA DE CACHÉ EN MEMORIA PARA OPTIMIZAR RECURSOS (CERO POLLING CONSTANTE DE BD)
// ==============================================================================
let cachedCitas: any[] = [];
let lastCacheFetch: number = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // Recargar de Base de Datos sólo una vez cada 15 minutos en background

async function refreshAppointmentsCache(force = false) {
  const now = Date.now();
  // Evitamos llamadas innecesarias a Supabase si ya tenemos los datos y no expiró el TTL
  if (!force && cachedCitas.length > 0 && (now - lastCacheFetch < CACHE_TTL_MS)) {
    return;
  }

  try {
    console.log("[CACHE] Refrescando copia local de citas de hoy/futuras desde Supabase para optimizar consumo...");
    const { data: dbCitas, error } = await supabase
      .from("citas")
      .select("*, pacientes(nombres, apellidos)")
      .eq("estado", "scheduled")
      .eq("recordatorio_enviado", false);

    if (error) {
      throw error;
    }

    cachedCitas = dbCitas || [];
    lastCacheFetch = now;
    console.log(`[CACHE] Copia local sincronizada exitosamente con Supabase. Citas activas: ${cachedCitas.length}`);
  } catch (err) {
    console.error("[CACHE] Error cargando citas de Supabase en memoria:", err);
  }
}

// ==============================================================================
// CHEQUEO AUTOMÁTICO DE CITAS (CONSUMO LOCAL, CERO BD HIT CORRIENDO CADA MINUTO)
// ==============================================================================
async function checkUpcomingAppointments() {
  const subscriptions = getSubscriptions();
  if (subscriptions.length === 0) return;

  try {
    // Asegurar que el caché contenga citas de hoy sin golpear la base de datos a menos que sea necesario
    await refreshAppointmentsCache();

    if (cachedCitas.length === 0) return;

    const nowUtc = Date.now();
    const updatedCitas = [...cachedCitas];
    let needsSaveState = false;

    for (let i = 0; i < updatedCitas.length; i++) {
      const appt = updatedCitas[i];
      if (!appt.fecha || !appt.hora || appt.recordatorio_enviado) continue;

      // Filtrar cuáles suscripciones coinciden con el rango de 20 minutos de anticipación
      const subsToNotify: SavedSubscription[] = [];

      for (const sub of subscriptions) {
        // Formato fecha: YYYY-MM-DD, hora: HH:MM
        const [year, month, day] = appt.fecha.split("-").map(Number);
        const [hour, minute] = appt.hora.split(":").map(Number);

        // Convertir la cita a milisegundos UTC sumando offset de zona horaria del cliente
        // Date.UTC asume año, mes (0-11), día, hora, minutos
        const apptLocalUtc = Date.UTC(year, month - 1, day, hour, minute);
        const apptUtcTimestamp = apptLocalUtc + (sub.timezoneOffset * 60 * 1000);

        // Diferencia en minutos
        const diffMinutes = (apptUtcTimestamp - nowUtc) / (60 * 1000);

        // Notificar si faltan entre 18.0 y 21.5 minutos (rango alrededor de los 20 min)
        if (diffMinutes >= 18.0 && diffMinutes <= 21.5) {
          subsToNotify.push(sub);
        }
      }

      if (subsToNotify.length > 0) {
        // Formatear datos de cita y paciente
        let patientName = "Paciente";
        if (appt.pacientes) {
          const nombres = appt.pacientes.nombres || "";
          const apellidos = appt.pacientes.apellidos || "";
          patientName = `${nombres} ${apellidos}`.trim();
        } else if (appt.motivo && appt.motivo.includes("|")) {
          patientName = appt.motivo.split("|")[0].trim();
        }

        let treatment = appt.motivo || "Consulta Clínica";
        if (!appt.pacientes && appt.motivo && appt.motivo.includes("|")) {
          treatment = appt.motivo.split("|")[1].trim();
        }

        const [y, m, d] = appt.fecha.split("-");
        const formattedDate = `${d}/${m}/${y}`;

        const payload = JSON.stringify({
          title: "Próximo Paciente (en 20 minutos)",
          body: `Paciente: ${patientName}\nHora: ${appt.hora} | ${formattedDate}\nTratamiento: ${treatment}`,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          vibrate: [200, 100, 200, 100, 200],
          data: {
            url: "/?view=appointments"
          }
        });

        console.log(`[ALERT] Enviando push desde caché local: ${patientName} @ ${appt.hora} (${treatment})`);

        const expiredEndpoints: string[] = [];

        for (const sub of subsToNotify) {
          try {
            await webpush.sendNotification(sub.subscription, payload);
          } catch (err: any) {
            console.error("Error al enviar notificación push:", err.message);
            // Si la suscripción expiró o ya no es válida (código 410 o 404), la limpiamos
            if (err.statusCode === 410 || err.statusCode === 404) {
              expiredEndpoints.push(sub.subscription.endpoint);
            }
          }
        }

        // Limpiar suscripciones expiradas
        if (expiredEndpoints.length > 0) {
          const activeSubs = subscriptions.filter(s => !expiredEndpoints.includes(s.subscription.endpoint));
          saveSubscriptions(activeSubs);
          console.log(`Removiendo ${expiredEndpoints.length} suscripciones inválidas.`);
        }

        // Registrar en Supabase que el recordatorio ya fue enviado para evitar duplicados
        try {
          await supabase
            .from("citas")
            .update({ recordatorio_enviado: true })
            .eq("id", appt.id);
          
          appt.recordatorio_enviado = true;
          needsSaveState = true;
        } catch (dbErr) {
          console.error("Error al marcar recordatorio_enviado en Supabase:", dbErr);
        }
      }
    }

    if (needsSaveState) {
      // Filtrar fuera las citas que ya enviaron alerta para no acumular basura en memoria
      cachedCitas = updatedCitas.filter(a => !a.recordatorio_enviado);
    }
  } catch (err) {
    console.error("Error en scheduler de recordatorios push:", err);
  }
}

// El chequeo local corre cada 60s, pero EVALUA SOLO LA RAM LOCAL (0 requests de bases de datos!)
setInterval(checkUpcomingAppointments, 60 * 1000);

// ==============================================================================
// RUTAS ENDPOINTS DE NOTIFICACIONES PUSH
// ==============================================================================

// 1. Obtener clave pública VAPID
app.get("/api/notifications/vapid-public-key", (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

// 2. Registrar/Suscribir un nuevo dispositivo
app.post("/api/notifications/subscribe", (req, res) => {
  const { subscription, timezoneOffset } = req.body;

  if (!subscription || !subscription.endpoint) {
    res.status(400).json({ error: "Suscripción inválida" });
    return;
  }

  const offset = typeof timezoneOffset === "number" ? timezoneOffset : 300; // Por defecto 300 min (Perú, UTC-5)
  const subscriptions = getSubscriptions();

  const index = subscriptions.findIndex(
    (s) => s.subscription.endpoint === subscription.endpoint
  );

  if (index !== -1) {
    subscriptions[index].timezoneOffset = offset;
    subscriptions[index].registeredAt = new Date().toISOString();
  } else {
    subscriptions.push({
      subscription,
      timezoneOffset: offset,
      registeredAt: new Date().toISOString()
    });
  }

  saveSubscriptions(subscriptions);
  console.log(`[PUSH] Dispositivo registrado exitosamente. Total: ${subscriptions.length}`);

  res.status(201).json({ success: true, message: "Suscripción de celular registrada" });
});

// 3. Enviar notificación push de prueba en tiempo real
app.post("/api/notifications/test-push", async (req, res) => {
  const subscriptions = getSubscriptions();
  if (subscriptions.length === 0) {
    res.status(400).json({ error: "No hay celulares registrados. Por favor registre su celular primero." });
    return;
  }

  const payload = JSON.stringify({
    title: "¡SM Dental Conectado!",
    body: "¡Felicidades! Las alertas automáticas directas están funcionando correctamente en tu celular. Recibirás avisos 20 minutos antes de cada paciente.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [100, 50, 100],
    data: { url: "/" }
  });

  const results = await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub.subscription, payload);
        return { endpoint: sub.subscription.endpoint, success: true };
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          return { endpoint: sub.subscription.endpoint, success: false, expired: true };
        }
        return { endpoint: sub.subscription.endpoint, success: false, error: err.message };
      }
    })
  );

  const expiredEndpoints = results.filter((r) => r.expired).map((r) => r.endpoint);
  if (expiredEndpoints.length > 0) {
    const activeSubs = subscriptions.filter((s) => !expiredEndpoints.includes(s.subscription.endpoint));
    saveSubscriptions(activeSubs);
  }

  res.json({ success: true, results });
});

// 4. Sincronizar Caché de citas bajo demanda (cuando se añade, edita o elimina una en el frontend)
app.post("/api/notifications/sync", async (req, res) => {
  try {
    await refreshAppointmentsCache(true);
    res.json({ success: true, count: cachedCitas.length });
  } catch (err: any) {
    res.status(500).json({ error: "Fallo al sincronizar caché de citas", details: err.message });
  }
});

// 5. Canal de Sincronización Móvil: Generación de Feed iCalendar (*.ics) dinámico y robusto
app.get("/api/notifications/calendar.ics", async (req, res) => {
  try {
    console.log("[CALENDAR] Generando feed iCal en tiempo real para el celular del doctor...");
    
    // Obtener citas programadas de la base de datos
    const { data: dbCitas, error } = await supabase
      .from("citas")
      .select("*, pacientes(nombres, apellidos)")
      .eq("estado", "scheduled");

    if (error) {
      throw error;
    }

    const citas = dbCitas || [];
    
    // Encabezado estándar de iCalendar
    let icsLines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SM Dental//App Dental//ES",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Citas - SM Dental",
      "X-WR-TIMEZONE:America/Lima",
      "X-WR-CALDESC:Lista de citas sincronizadas de la Clínica Dental San Miguel",
      "REFRESH-INTERVAL;VALUE=DURATION:PT15M", // Indicar al iPhone/Android que actualice cada 15 minutos en background
      "X-PUBLISHED-TTL:PT15M"
    ];

    for (const appt of citas) {
      if (!appt.fecha || !appt.hora) continue;

      // Dividir fecha (YYYY-MM-DD) y hora (HH:MM)
      const dateNoDash = appt.fecha.replace(/-/g, ""); // Ej: "2026-06-08" -> "20260608"
      const timeNoColon = appt.hora.replace(/:/g, ""); // Ej: "09:30" -> "0930"
      const startDateTime = `${dateNoDash}T${timeNoColon}00`; // "20260608T093000"

      // Calcular hora de término (+30 minutos por defecto para evitar sobrelapos)
      const [hour, min] = appt.hora.split(":").map(Number);
      let endMins = min + 30;
      let endHours = hour;
      if (endMins >= 60) {
        endHours += Math.floor(endMins / 60);
        endMins = endMins % 60;
      }
      const endHourStr = String(endHours % 24).padStart(2, "0");
      const endMinStr = String(endMins).padStart(2, "0");
      const endDateTime = `${dateNoDash}T${endHourStr}${endMinStr}00`;

      // Obtener nombre del paciente
      let patientName = "Paciente";
      if (appt.pacientes) {
        const nombres = appt.pacientes.nombres || "";
        const apellidos = appt.pacientes.apellidos || "";
        patientName = `${nombres} ${apellidos}`.trim();
      } else if (appt.motivo && appt.motivo.includes("|")) {
        patientName = appt.motivo.split("|")[0].trim();
      }

      // Obtener tratamiento
      let treatment = appt.motivo || "Consulta Clínica";
      if (!appt.pacientes && appt.motivo && appt.motivo.includes("|")) {
        treatment = appt.motivo.split("|")[1].trim();
      }

      const uid = `smdental_appt_${appt.id}@smdental.com`;

      // Añadir evento individual con alarma sonora nativa 50 minutos antes
      icsLines.push("BEGIN:VEVENT");
      icsLines.push(`UID:${uid}`);
      icsLines.push(`DTSTAMP:${dateNoDash}T000000`);
      icsLines.push(`DTSTART:${startDateTime}`);
      icsLines.push(`DTEND:${endDateTime}`);
      icsLines.push(`SUMMARY:🦷 CITA DENTAL: ${patientName}`);
      icsLines.push(`DESCRIPTION:Tratamiento: ${treatment}\\nEstado: Agendado en SM Dental.`);
      icsLines.push("LOCATION:Clínica Dental San Miguel");
      
      // Alarma del celular nativa (VALARM) 50 minutos antes
      icsLines.push("BEGIN:VALARM");
      icsLines.push("TRIGGER:-PT50M"); // Exactamente 50 minutos antes de la cita
      icsLines.push("ACTION:DISPLAY");
      icsLines.push(`DESCRIPTION:Recordatorio de Cita: ${patientName} en 50 minutos`);
      icsLines.push("END:VALARM");
      
      icsLines.push("END:VEVENT");
    }

    icsLines.push("END:VCALENDAR");

    // Enviar archivo de calendario en formato compatible con cualquier dispositivo móvil
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=smdental_citas.ics");
    res.send(icsLines.join("\r\n"));

  } catch (err: any) {
    console.error("[CALENDAR ERROR] Fallo al generar iCal:", err);
    res.status(500).send("Error al generar el calendario.");
  }
});

// ==============================================================================
// ASISTENTE DE IA DE GEMINI
// ==============================================================================
const SYSTEM_INSTRUCTION = `Actúa como un asistente dental experto para la Clínica Dental San Miguel. 
Tu objetivo es ayudar a los dentistas con sugerencias de diagnósticos, farmacología dental y redacción de instrucciones post-operatorias. 
Sé profesional, conciso y utiliza terminología clínica precisa. 
Importante: Siempre añade una nota de descargo indicando que tus sugerencias deben ser validadas por el profesional a cargo.`;

app.post("/api/assistant/ask", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "El prompt es requerido y debe ser una cadena de texto." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not defined in the environment variables.");
    res.status(500).json({ 
      error: "El servicio de Inteligencia Artificial no está configurado por falta de la credencial GEMINI_API_KEY." 
    });
    return;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ 
      error: "Error al generar la respuesta con la IA", 
      details: error.message || error 
    });
  }
});

// ==============================================================================
// ALMACENAMIENTO DE IMÁGENES CLÍNICAS (BACKBLAZE B2 NATIVE + S3 HYBRID)
// ==============================================================================
interface B2AuthState {
  accountId: string;
  authorizationToken: string;
  apiUrl: string;
  downloadUrl: string;
  s3ApiUrl?: string;
  expiresAt: number;
}

let cachedB2Auth: B2AuthState | null = null;
let cachedBucketId: string | null = null;

// Default Backblaze B2 credentials for Clínica Dental San Miguel bucket
const DEFAULT_B2_BUCKET = "dental-san-miguel-fotos";
const DEFAULT_B2_KEY_ID = "005d30d02d5df980000000002";
const DEFAULT_B2_APP_KEY = "K005VH4caGLzGOScLY6CudpUZqNUdKc";
const DEFAULT_B2_ENDPOINT = "s3.us-east-005.backblazeb2.com";
const DEFAULT_B2_REGION = "us-east-005";

async function getB2NativeAuth(): Promise<B2AuthState | null> {
  const keyId = process.env.B2_KEY_ID?.trim() || process.env.B2_APPLICATION_KEY_ID?.trim() || DEFAULT_B2_KEY_ID;
  const appKey = process.env.B2_APPLICATION_KEY?.trim() || DEFAULT_B2_APP_KEY;

  if (!keyId || !appKey) return null;

  // Si el token aún es válido (margen de 10 min), reutilizarlo
  if (cachedB2Auth && Date.now() < cachedB2Auth.expiresAt - 10 * 60 * 1000) {
    return cachedB2Auth;
  }

  try {
    const basicAuth = Buffer.from(`${keyId}:${appKey}`).toString("base64");
    const res = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
      headers: { Authorization: `Basic ${basicAuth}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[STORAGE] Backblaze auth (${res.status}): ${errText}`);
      return null;
    }

    const data: any = await res.json();
    cachedB2Auth = {
      accountId: data.accountId,
      authorizationToken: data.authorizationToken,
      apiUrl: data.apiInfo?.storageApi?.apiUrl,
      downloadUrl: data.apiInfo?.storageApi?.downloadUrl,
      s3ApiUrl: data.apiInfo?.storageApi?.s3ApiUrl,
      expiresAt: Date.now() + 20 * 60 * 60 * 1000,
    };
    return cachedB2Auth;
  } catch (err: any) {
    console.warn("[STORAGE] Error autorizando con Backblaze B2:", err.message);
    return null;
  }
}

async function getB2BucketId(auth: B2AuthState, bucketName: string): Promise<string | null> {
  if (cachedBucketId) return cachedBucketId;

  try {
    const res = await fetch(`${auth.apiUrl}/b2api/v3/b2_list_buckets`, {
      method: "POST",
      headers: {
        Authorization: auth.authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accountId: auth.accountId,
        bucketName,
      }),
    });

    if (!res.ok) return null;
    const data: any = await res.json();
    const bucket = data.buckets?.find((b: any) => b.bucketName === bucketName);
    if (bucket?.bucketId) {
      cachedBucketId = bucket.bucketId;
      return cachedBucketId;
    }
    return null;
  } catch {
    return null;
  }
}

async function uploadToB2Native(
  buffer: Buffer,
  fileName: string,
  contentType: string,
  bucketName: string
): Promise<{ url: string; key: string; sizeBytes: number } | null> {
  try {
    const auth = await getB2NativeAuth();
    if (!auth) return null;

    const bucketId = await getB2BucketId(auth, bucketName);
    if (!bucketId) return null;

    const upUrlRes = await fetch(`${auth.apiUrl}/b2api/v3/b2_get_upload_url`, {
      method: "POST",
      headers: {
        Authorization: auth.authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bucketId }),
    });

    if (!upUrlRes.ok) {
      cachedB2Auth = null;
      return null;
    }

    const upUrlData: any = await upUrlRes.json();
    const sha1 = crypto.createHash("sha1").update(buffer).digest("hex");

    const uploadRes = await fetch(upUrlData.uploadUrl, {
      method: "POST",
      headers: {
        Authorization: upUrlData.authorizationToken,
        "X-Bz-File-Name": encodeURIComponent(fileName).replace(/%2F/g, "/"),
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
        "X-Bz-Content-Sha1": sha1,
      },
      body: buffer,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.warn(`[STORAGE] Fallo en b2_upload_file (${uploadRes.status}):`, errText);
      return null;
    }

    const uploadData: any = await uploadRes.json();
    const publicUrl = `${auth.downloadUrl}/file/${bucketName}/${uploadData.fileName}`;
    return {
      url: publicUrl,
      key: uploadData.fileName,
      sizeBytes: buffer.length,
    };
  } catch (err: any) {
    console.warn("[STORAGE] Error en uploadToB2Native:", err.message);
    return null;
  }
}

async function uploadToB2S3(
  buffer: Buffer,
  fileName: string,
  contentType: string,
  bucketName: string,
  keyId: string,
  appKey: string
): Promise<{ url: string; key: string; sizeBytes: number } | null> {
  try {
    const endpoint = process.env.B2_ENDPOINT?.trim() || DEFAULT_B2_ENDPOINT;
    let region = process.env.B2_REGION?.trim() || DEFAULT_B2_REGION;
    if (!region) {
      const match = endpoint.match(/s3\.([a-z0-9-]+)\.backblazeb2\.com/i);
      if (match) region = match[1];
    }
    if (!region) region = "us-east-005";
    const cleanEndpoint = endpoint.startsWith("http") ? endpoint : `https://${endpoint}`;

    const client = new S3Client({
      endpoint: cleanEndpoint,
      region,
      credentials: {
        accessKeyId: keyId,
        secretAccessKey: appKey,
      },
    });

    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: buffer,
        ContentType: contentType,
      })
    );

    const publicUrl = `https://f005.backblazeb2.com/file/${bucketName}/${fileName}`;
    return { url: publicUrl, key: fileName, sizeBytes: buffer.length };
  } catch (err: any) {
    console.warn("[STORAGE] Intento S3 no aplicable:", err.message);
    return null;
  }
}

// 1. Estado de la conexión con Backblaze B2
app.get("/api/storage/status", async (req, res) => {
  const bucketName = process.env.B2_BUCKET_NAME?.trim() || DEFAULT_B2_BUCKET;
  const keyId = process.env.B2_KEY_ID?.trim() || process.env.B2_APPLICATION_KEY_ID?.trim() || DEFAULT_B2_KEY_ID;
  const appKey = process.env.B2_APPLICATION_KEY?.trim() || DEFAULT_B2_APP_KEY;

  if (!bucketName || !keyId || !appKey) {
    res.json({
      configured: false,
      provider: "supabase_direct",
      message: "Backblaze B2 no configurado. Las imágenes se guardan optimizadas en Supabase.",
    });
    return;
  }

  // Verificar conexión con la API de Backblaze
  const auth = await getB2NativeAuth();
  if (auth) {
    res.json({
      configured: true,
      provider: "backblaze",
      bucketName,
      status: "connected",
      message: `Backblaze B2 conectado con éxito (Bucket: ${bucketName}).`,
    });
    return;
  }

  res.json({
    configured: true,
    provider: "backblaze",
    bucketName,
    status: "configured",
    message: `Credenciales de Backblaze configuradas para ${bucketName}.`,
  });
});

function formatPatientFolderName(patientName?: string, patientId?: string): string {
  if (patientName && typeof patientName === "string" && patientName.trim()) {
    const clean = patientName
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9 _-]/g, "")
      .trim()
      .replace(/\s+/g, "_");
    if (clean) return clean;
  }
  return (patientId || "general").replace(/[^a-zA-Z0-9_-]/g, "");
}

// 2. Subida de imágenes a Backblaze B2 (Archivado permanente e inmutable)
app.post("/api/storage/upload", async (req, res) => {
  const { dataUrl, patientId, patientName, label, mimeType } = req.body;

  if (!dataUrl || typeof dataUrl !== "string") {
    res.status(400).json({ error: "No se proporcionó la imagen requerida." });
    return;
  }

  const bucketName = process.env.B2_BUCKET_NAME?.trim() || DEFAULT_B2_BUCKET;
  const keyId = process.env.B2_KEY_ID?.trim() || process.env.B2_APPLICATION_KEY_ID?.trim() || DEFAULT_B2_KEY_ID;
  const appKey = process.env.B2_APPLICATION_KEY?.trim() || DEFAULT_B2_APP_KEY;

  // Si Backblaze B2 tiene credenciales, proceder con la subida
  if (bucketName && keyId && appKey) {
    try {
      let base64Data = dataUrl;
      let contentType = mimeType || "image/webp";

      if (dataUrl.includes(",")) {
        const parts = dataUrl.split(",");
        const match = parts[0].match(/:(.*?);/);
        if (match) contentType = match[1];
        base64Data = parts[1];
      }

      const buffer = Buffer.from(base64Data, "base64");
      const ext = contentType.includes("png") ? "png" : contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "webp";

      // Obtener o resolver el nombre y apellido del paciente para crear la carpeta
      let resolvedName = (patientName || "").trim();
      if (!resolvedName && patientId && patientId !== "general") {
        try {
          const { data: pData } = await supabase
            .from("pacientes")
            .select("name, nombres, apellidos")
            .eq("id", patientId)
            .maybeSingle();
          if (pData) {
            resolvedName = pData.name || `${pData.nombres || ""} ${pData.apellidos || ""}`.trim();
          }
        } catch {
          // Continuar con fallback si la consulta falla
        }
      }

      const folderName = formatPatientFolderName(resolvedName, patientId);
      const fileName = `pacientes/${folderName}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

      // Intento 1: API Nativa de Backblaze B2 (soporta credenciales maestras y de aplicación)
      let uploadResult = await uploadToB2Native(buffer, fileName, contentType, bucketName);

      // Intento 2: API S3 (por si se usan llaves S3 dedicadas)
      if (!uploadResult) {
        uploadResult = await uploadToB2S3(buffer, fileName, contentType, bucketName, keyId, appKey);
      }

      if (uploadResult) {
        console.log(`[STORAGE] Imagen clínica guardada en Backblaze B2: ${uploadResult.url} (${(buffer.length / 1024).toFixed(1)} KB)`);
        res.json({
          success: true,
          url: uploadResult.url,
          provider: "backblaze",
          key: uploadResult.key,
          sizeBytes: uploadResult.sizeBytes,
        });
        return;
      }
    } catch (b2Error: any) {
      console.warn("[STORAGE] Advertencia en subida Backblaze:", b2Error.message || b2Error);
    }

    // Fallback seguro a dataUrl si fallara temporalmente el proveedor de almacenamiento
    res.json({
      success: true,
      url: dataUrl,
      provider: "fallback_direct",
      warning: "Almacenado localmente en la base de datos debido a fallo temporal en la nube externa.",
    });
    return;
  }

  // Si no está configurado, continuar con almacenamiento optimizado en Supabase
  res.json({
    success: true,
    url: dataUrl,
    provider: "supabase_direct",
    note: "Backblaze B2 no configurado. Almacenado como Data URL optimizado.",
  });
});

// ==============================================================================
// EJECUCIÓN DEL SERVIDOR & VITE MIDDLEWARE
// ==============================================================================
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite HMR...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode serving static files...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

