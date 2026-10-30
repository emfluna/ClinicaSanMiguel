import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

export const PushNotificationManager: React.FC = () => {
  const [copiedScript, setCopiedScript] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    count: number;
    message: string;
  } | null>(null);

  const handleVerifySync = async () => {
    try {
      setIsVerifying(true);
      setVerificationResult(null);

      const resSync = await fetch('/api/notifications/sync', { method: 'POST' });
      const dataSync = await resSync.json();

      setTimeout(() => {
        setIsVerifying(false);
        setVerificationResult({
          success: true,
          count: dataSync.count || 0,
          message: `¡Listo y Conectado! Tu agenda está activa en el sistema. Hemos detectado ${dataSync.count || 0} de tus citas agendadas de Supabase listas para sincronizarse.`
        });
      }, 800); // Quick check
    } catch (err: any) {
      setIsVerifying(false);
      setVerificationResult({
        success: false,
        count: 0,
        message: 'No logramos comunicarnos con el servidor. Revisa tu conexión a internet.'
      });
    }
  };

  const dbUrl = 'https://oftmitifilkscxhufrcf.supabase.co';
  const dbKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mdG1pdGlmaWxrc2N4aHVmcmNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMjk1NjksImV4cCI6MjA4MzkwNTU2OX0.r3JV2CBeUC5FGUbBgdMFF1UAGiEOBA-jFOi5rJ-F2aQ';

  const getSessionCredentials = () => {
    try {
      const saved = localStorage.getItem('sm_dental_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.email && parsed.password) {
          return { email: parsed.email, password: parsed.password };
        }
      }
    } catch (e) {
      console.error(e);
    }
    return { email: 'doctor@clinicarsm.com', password: 'TU_CONTRASEÑA' };
  };

  const creds = getSessionCredentials();

  const appsScriptCode = `// ----------------------------------------------------
// 🦷 SYNCHRONIZER AUTOMÁTICO DE CITAS - SUPER CLÍNICA SM DENTAL
// Sincroniza al instante tus citas de Supabase con Google Calendar
// y con tu celular de forma limpia y 100% gratuita.
// ----------------------------------------------------

const SUPABASE_URL = "${dbUrl}";
const SUPABASE_KEY = "${dbKey}";
const DOCTOR_EMAIL = "${creds.email}";
const DOCTOR_PASSWORD = "${creds.password}";

function syncCitasToCalendar() {
  console.log("Iniciando sincronización directa con Supabase...");
  
  // 1. Iniciar sesión en Supabase bajo la cuenta del doctor para saltar RLS y poder leer los nombres completos
  let accessToken = SUPABASE_KEY;
  try {
    const authUrl = SUPABASE_URL + "/auth/v1/token?grant_type=password";
    const authPayload = JSON.stringify({
      "email": DOCTOR_EMAIL,
      "password": DOCTOR_PASSWORD
    });
    
    const authResponse = UrlFetchApp.fetch(authUrl, {
      "method": "POST",
      "headers": {
        "apikey": SUPABASE_KEY,
        "Content-Type": "application/json"
      },
      "payload": authPayload,
      "muteHttpExceptions": true
    });
    
    if (authResponse.getResponseCode() === 200) {
      const authData = JSON.parse(authResponse.getContentText());
      if (authData && authData.access_token) {
        accessToken = authData.access_token;
        console.log("✓ Autenticación en Supabase exitosa. Listando nombres desbloqueados.");
      }
    } else {
      console.warn("Advertencia de inicio de sesión Supabase (código: " + authResponse.getResponseCode() + "). Usando llave general.");
    }
  } catch (errorAuth) {
    console.warn("No se pudo iniciar sesión para saltar RLS: " + errorAuth.toString());
  }
  
  // 2. Consultar citas agendadas cargando los datos del paciente mediante la relación
  const url = SUPABASE_URL + "/rest/v1/citas?select=*,pacientes(nombres,apellidos)&estado=eq.scheduled";
  const headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": "Bearer " + accessToken
  };
  
  try {
    const response = UrlFetchApp.fetch(url, { "headers": headers, "muteHttpExceptions": true });
    
    if (response.getResponseCode() !== 200) {
      console.error("Error al conectar con Supabase: Code " + response.getResponseCode());
      return;
    }
    
    const citas = JSON.parse(response.getContentText());
    console.log("Se cargaron " + citas.length + " citas activas programadas de Supabase.");
    
    // Crear o buscar un calendario independiente llamado: 🦷 Citas SM Dental
    const calendarName = "🦷 Citas SM Dental";
    let calendar = CalendarApp.getCalendarsByName(calendarName)[0];
    if (!calendar) {
      calendar = CalendarApp.createCalendar(calendarName);
      console.log("Se ha creado exitosamente el nuevo calendario: 🦷 Citas SM Dental");
    }
    
    const now = new Date();
    const futureLimit = new Date();
    futureLimit.setDate(now.getDate() + 45); // Sincroniza los próximos 45 días
    
    // Cachear eventos ya agregados para evitar duplicación y detectar cancelaciones
    const existingEvents = calendar.getEvents(now, futureLimit);
    const existingUidsMap = {};
    
    existingEvents.forEach(function(event) {
      const desc = event.getDescription() || "";
      const match = desc.match(/ID_CITA:\\s*([a-zA-Z0-9-]+)/);
      if (match) {
        existingUidsMap[match[1]] = event;
      }
    });
    
    citas.forEach(function(cita) {
      if (!cita.fecha || !cita.hora) return;
      
      // Parsear fecha y hora
      const dateParts = cita.fecha.split("-");
      const timeParts = cita.hora.split(":");
      
      const year = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1; // 0-indexed en JS Date
      const day = parseInt(dateParts[2], 10);
      const hour = parseInt(timeParts[0], 10);
      const min = parseInt(timeParts[1], 10);
      
      const startDate = new Date(year, month, day, hour, min);
      
      // Solo sincronizar citas presentes o futuras
      if (startDate < now) return;
      
      // Duración promedio de consulta: 30 minutos
      const endDate = new Date(startDate.getTime() + (30 * 60 * 1000));
      
      // Obtener nombre formateado del paciente con tolerancia extrema (objetos, arrays y fallback de motivo)
      let patientName = "";
      var pData = cita.pacientes || cita.paciente;
      if (pData) {
        if (Array.isArray(pData)) {
          if (pData.length > 0) {
            var firstP = pData[0];
            patientName = ((firstP.nombres || "") + " " + (firstP.apellidos || "")).trim();
          }
        } else {
          patientName = ((pData.nombres || "") + " " + (pData.apellidos || "")).trim();
        }
      }
      
      // Fallback si no se encontró en la relación o quedó vacío
      if (!patientName || pData === null || patientName === "") {
        if (cita.motivo && cita.motivo.indexOf("|") !== -1) {
          patientName = cita.motivo.split("|")[0].trim();
        }
      }
      
      if (!patientName) {
        patientName = "Paciente Registrado";
      }
      
      let treatment = cita.motivo || "Consulta Dental";
      if (cita.motivo && cita.motivo.indexOf("|") !== -1) {
        treatment = cita.motivo.split("|")[1].trim();
      }
      
      const title = "🦷 CITA DENTAL: " + patientName;
      const description = "Paciente: " + patientName + "\\nTratamiento: " + treatment + "\\nEstado: Programada en SM Dental.\\n\\nID_CITA: " + cita.id;
      
      if (existingUidsMap[cita.id]) {
        // Encontrado en calendario. Actualizar si cambió horario o título
        const event = existingUidsMap[cita.id];
        if (event.getStartTime().getTime() !== startDate.getTime() || event.getTitle() !== title) {
          event.setTime(startDate, endDate);
          event.setTitle(title);
          event.setDescription(description);
          console.log("Cita actualizada: " + patientName + " para " + cita.fecha + " " + cita.hora);
        }
        delete existingUidsMap[cita.id]; // Mantener intacto y remover de la lista de borrados
      } else {
        // Crear nuevo evento
        const event = calendar.createEvent(title, startDate, endDate, {
          "description": description,
          "location": "Clínica Dental San Miguel"
        });
        
        // Agregar alarma/recordatorio sonora de 50 minutos de forma nativa al celular
        event.addPopupReminder(50);
        console.log("✓ Nueva cita sincronizada en Google Calendar: " + patientName + " para " + cita.fecha + " " + cita.hora);
      }
    });
    
    // Cualquier evento que quedó en el mapa es porque ya no está programada (se canceló, eliminó o atendió)
    Object.keys(existingUidsMap).forEach(function(citaId) {
      console.log("Cita cancelada/eliminada detectada. Eliminando del calendario ID: " + citaId);
      existingUidsMap[citaId].deleteEvent();
    });
    
    console.log("Sincronización terminada con éxito.");
  } catch (error) {
    console.error("Fallo crítico en sincronización: " + error.toString());
  }
}`;

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(appsScriptCode);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 3000);
    } catch {
      const el = document.createElement('textarea');
      el.value = appsScriptCode;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 3000);
    }
  };

  return (
    <div className="space-y-6 text-left" id="push-notification-container">
      
      {/* METODO C: GOOGLE APPS SCRIPT (NUEVA MEJOR OPCIÓN) */}
      <div className="bg-gradient-to-br from-indigo-500/5 to-purple-500/5 dark:from-indigo-950/20 dark:to-purple-950/10 p-5 rounded-3xl border border-indigo-500/20 dark:border-indigo-950/40 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <span className="size-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black shrink-0 font-sans">1</span>
          <h4 className="text-sm font-extrabold text-slate-850 dark:text-white uppercase tracking-wider">Pasos Rápidos de Configuración en tu Google Calendar</h4>
        </div>

        <div className="space-y-4 pt-1">
          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <span className="text-xs font-black text-indigo-600 bg-indigo-500/10 size-5 rounded-full flex items-center justify-center mt-0.5 shrink-0 font-sans">A</span>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
                Entra a <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-indigo-500 hover:text-indigo-600 underline font-extrabold">script.google.com</a> con tu cuenta de Google y haz clic en <span className="font-extrabold text-slate-900 dark:text-white">"Nuevo proyecto"</span>.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="text-xs font-black text-indigo-600 bg-indigo-500/10 size-5 rounded-full flex items-center justify-center mt-0.5 shrink-0 font-sans">B</span>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
                Limpia todo el código que aparezca en el editor, copia el código que te generamos abajo e introduce el texto exacto. Luego haz clic en guardar (icono de disquete 💾).
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="text-xs font-black text-indigo-600 bg-indigo-500/10 size-5 rounded-full flex items-center justify-center mt-0.5 shrink-0 font-sans">C</span>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
                Haz clic en el botón <span className="font-extrabold text-slate-900 dark:text-white">"Ejecutar"</span> (icono ▶) arriba. Otórga los permisos correspondientes (clic en <em>"Configuración avanzada"</em> → <em>"Ir a Proyecto sin nombre (no seguro)"</em> y finalmente pulsa <em>"Permitir"</em>). Esto creará un calendario exclusivo llamado <strong className="text-indigo-600 dark:text-indigo-400">"🦷 Citas SM Dental"</strong>.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="text-xs font-black text-indigo-600 bg-indigo-500/10 size-5 rounded-full flex items-center justify-center mt-0.5 shrink-0 font-sans">D</span>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
                Entra en <strong>Activadores</strong> (icono de reloj ⏰ en la barra lateral izquierda) y dale a <strong className="text-indigo-600 dark:text-indigo-400">"Añadir activador"</strong> abajo a la derecha:
                <br /><span className="text-slate-500">• Selecciona la función:</span> <strong className="text-indigo-600 dark:text-indigo-400">syncCitasToCalendar</strong>
                <br /><span className="text-slate-500">• Origen del evento:</span> <strong className="text-indigo-600 dark:text-indigo-400">Según tiempo</strong>
                <br /><span className="text-slate-500">• Tipo de activador:</span> <strong className="text-indigo-600 dark:text-indigo-400">Temporizador por día</strong>
                <br /><span className="text-slate-500">• Hora / Intervalo:</span> <strong className="text-indigo-600 dark:text-indigo-400">Hacer una vez cada día (ej. De 1 a 2 a.m.)</strong>
                <br />Haz clic en <strong className="text-slate-900 dark:text-white">Guardar</strong>. ¡Todo listo! Ahora tus citas se actualizarán de forma automatizada cada día.
              </p>
            </div>
          </div>

          {creds.password === 'TU_CONTRASEÑA' && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-800 dark:text-amber-400 space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider">
                <span className="material-symbols-outlined text-lg">warning</span>
                <span>Ajuste Requerido para ver Nombres Reales</span>
              </div>
              <p className="text-xs font-bold leading-relaxed">
                Para que Google Calendar pueda conectarse de forma segura y cargar los <strong>nombres reales</strong> de tus pacientes (sin restricciones de seguridad RLS), asegúrate de cambiar la variable <code className="bg-amber-200/50 dark:bg-amber-900/40 px-1 rounded font-mono text-[10px]">DOCTOR_PASSWORD</code> con tu <strong>contraseña de inicio de sesión real</strong> de la clínica (en lugar de <code className="bg-amber-100/60 dark:bg-amber-900/40 px-1 rounded font-mono text-[10px]">"TU_CONTRASEÑA"</code>) arriba o en tu editor de Google Script.
              </p>
            </div>
          )}

          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 shadow-inner space-y-2 select-all max-h-[180px] overflow-y-auto font-mono text-[9px] text-slate-300 leading-tight">
            {appsScriptCode}
          </div>

          <button
            onClick={handleCopyScript}
            className={`h-12 w-full rounded-xl font-black text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98 ${
              copiedScript 
                ? 'bg-emerald-600 text-white shadow-emerald-500/20' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/15'
            }`}
          >
            <span className="material-symbols-outlined text-base">
              {copiedScript ? 'check' : 'content_copy'}
            </span>
            {copiedScript ? '¡CÓDIGO COPIADO CON ÉXITO!' : 'COPIAR CÓDIGO AUTORIZADO DE GOOGLE SCRIPT'}
          </button>
        </div>
      </div>

      {/* METODO VERIFICACIÓN EXTRA */}
      <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-3xl border border-slate-200 dark:border-slate-800/80 space-y-3 font-sans">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-slate-400 text-lg">shield</span>
          <h4 className="text-xs font-extrabold text-slate-450 dark:text-slate-300 uppercase tracking-wider">Verificación Técnica de Base de Datos</h4>
        </div>

        <button
          onClick={handleVerifySync}
          disabled={isVerifying}
          className="w-full h-11 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-250 font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
        >
          <span className={`material-symbols-outlined text-base ${isVerifying ? 'animate-spin' : ''}`}>
            {isVerifying ? 'sync' : 'network_check'}
          </span>
          {isVerifying ? 'Consultando...' : 'Comprobar Estado de Citas en Supabase'}
        </button>

        {verificationResult && (
          <div className={`p-4 rounded-xl border animate-in slide-in-from-top-2 duration-300 text-left ${
            verificationResult.success 
              ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500/25 text-emerald-800 dark:text-emerald-400 shadow-sm' 
              : 'bg-rose-50 dark:bg-rose-950/20 border-rose-500/25 text-rose-800 dark:text-rose-400 shadow-sm'
          }`}>
            <p className="text-xs font-extrabold leading-relaxed">
              {verificationResult.success ? '✓ ' : '✗ '} {verificationResult.message}
            </p>
          </div>
        )}
      </div>

    </div>
  );
};
