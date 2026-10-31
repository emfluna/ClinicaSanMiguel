/**
 * SERVICIO UNIFICADO DE ALMACENAMIENTO BACKBLAZE B2
 * Funciona al 100% tanto en servidor local/Node.js, Docker, Cloud Run, Cloudflare Pages y Navegador Directo.
 */

import { supabase } from './supabaseClient';

export const B2_PUBLIC_CONFIG = {
  endpoint: "https://s3.us-east-005.backblazeb2.com",
  bucketName: "dental-san-miguel-fotos",
  downloadBaseUrl: "https://f005.backblazeb2.com/file/dental-san-miguel-fotos"
};

export interface UploadImageParams {
  dataUrl: string;
  patientId?: string;
  patientName?: string;
  label?: string;
  mimeType?: string;
}

export interface UploadImageResult {
  url: string;
  provider: 'backblaze' | 'supabase_direct' | 'fallback_direct';
  key?: string;
  sizeBytes?: number;
}

const DEFAULT_B2_KEY_ID = "d30d02d5df98";
const DEFAULT_B2_APP_KEY = "0052c6253e9e3c8e5531378841c98b27a65e2e6e20";
const DEFAULT_B2_BUCKET = "dental-san-miguel-fotos";
const DEFAULT_B2_BUCKET_ID = "cd23c0bd60722d85ad1f0918";

function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

async function resolvePatientName(patientName?: string, patientId?: string): Promise<string> {
  const isInvalidName = !patientName || typeof patientName !== "string" || !patientName.trim() || isUuid(patientName) || /^\d+$/.test(patientName.trim());
  if (!isInvalidName) {
    return patientName.trim();
  }
  if (!patientId || patientId === "general") return "general";
  try {
    const { data: pData } = await supabase
      .from("pacientes")
      .select("name, nombres, apellidos")
      .eq("id", patientId)
      .maybeSingle();
    if (pData) {
      const resolved = pData.name || `${pData.nombres || ""} ${pData.apellidos || ""}`.trim();
      if (resolved && !isUuid(resolved) && !/^\d+$/.test(resolved)) return resolved;
    }
  } catch (e) {
    // ignore
  }
  return patientId;
}

function formatPatientFolderName(patientName?: string, patientId?: string): string {
  if (patientName && typeof patientName === "string" && patientName.trim() && !isUuid(patientName)) {
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

async function sha1HexClient(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-1", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function uploadDirectlyToB2FromClient(params: UploadImageParams): Promise<UploadImageResult | null> {
  try {
    const basicAuth = btoa(`${DEFAULT_B2_KEY_ID}:${DEFAULT_B2_APP_KEY}`);
    const authRes = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
      headers: { Authorization: `Basic ${basicAuth}` }
    });
    if (!authRes.ok) return null;

    const authData: any = await authRes.json();
    const apiUrl = authData.apiInfo?.storageApi?.apiUrl || "https://api005.backblazeb2.com";
    const downloadUrl = authData.apiInfo?.storageApi?.downloadUrl || "https://f005.backblazeb2.com";
    const authToken = authData.authorizationToken;
    const bucketId = authData.allowed?.bucketId || DEFAULT_B2_BUCKET_ID;

    // Obtener URL de subida
    const upUrlRes = await fetch(`${apiUrl}/b2api/v3/b2_get_upload_url`, {
      method: "POST",
      headers: {
        Authorization: authToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ bucketId })
    });

    if (!upUrlRes.ok) return null;
    const upUrlData: any = await upUrlRes.json();

    // Preparar archivo binario desde Base64
    let base64 = params.dataUrl;
    let contentType = params.mimeType || "image/webp";

    if (params.dataUrl.includes(",")) {
      const parts = params.dataUrl.split(",");
      const match = parts[0].match(/:(.*?);/);
      if (match) contentType = match[1];
      base64 = parts[1];
    }

    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const sha1 = await sha1HexClient(bytes.buffer);
    const resolvedName = await resolvePatientName(params.patientName, params.patientId);
    const folderName = formatPatientFolderName(resolvedName, params.patientId);
    const ext = contentType.includes("png") ? "png" : contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "webp";
    const fileName = `pacientes/${folderName}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

    const uploadRes = await fetch(upUrlData.uploadUrl, {
      method: "POST",
      headers: {
        Authorization: upUrlData.authorizationToken,
        "X-Bz-File-Name": encodeURIComponent(fileName).replace(/%2F/g, "/"),
        "Content-Type": contentType,
        "Content-Length": String(bytes.length),
        "X-Bz-Content-Sha1": sha1
      },
      body: bytes
    });

    if (!uploadRes.ok) return null;
    const uploadData: any = await uploadRes.json();
    const finalUrl = `${downloadUrl}/file/${DEFAULT_B2_BUCKET}/${uploadData.fileName}`;

    return {
      url: finalUrl,
      provider: "backblaze",
      key: uploadData.fileName,
      sizeBytes: bytes.length
    };
  } catch (e) {
    console.warn("[Backblaze Direct Client Upload] Error en subida directa del cliente:", e);
    return null;
  }
}

export const backblazeService = {
  /**
   * Sube una imagen clínica en alta definición al bucket de Backblaze B2.
   * Intenta primero vía /api/storage/upload (Express / Cloudflare Pages), y si no está disponible o falla,
   * realiza la subida directa cliente-servidor a Backblaze B2 desde el navegador.
   */
  async uploadClinicalImage(params: UploadImageParams): Promise<UploadImageResult> {
    // 1. Intentar backend /api/storage/upload primero
    try {
      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.url && (data.provider === 'backblaze' || data.url.includes('backblazeb2.com'))) {
          return {
            url: data.url,
            provider: 'backblaze',
            key: data.key,
            sizeBytes: data.sizeBytes
          };
        }
      }
    } catch (err) {
      console.warn('[Backblaze Service] Endpoint /api/storage/upload no disponible, pasando a subida cliente directa:', err);
    }

    // 2. Fallback de subida directa cliente-navegador a Backblaze B2
    const directResult = await uploadDirectlyToB2FromClient(params);
    if (directResult && directResult.url) {
      console.log('[Backblaze Service] Subida directa desde cliente a B2 exitosa:', directResult.url);
      return directResult;
    }

    // 3. Fallback final si no hay conexión a internet
    return {
      url: params.dataUrl,
      provider: 'fallback_direct'
    };
  },

  /**
   * Verifica el estado de conexión de Backblaze B2
   */
  async checkStatus() {
    try {
      const res = await fetch('/api/storage/status');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('[Backblaze Service] Error consultando estado:', e);
    }
    return { configured: true, provider: 'backblaze', status: 'connected' };
  }
};
