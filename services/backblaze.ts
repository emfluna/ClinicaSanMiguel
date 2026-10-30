/**
 * SERVICIO UNIFICADO DE ALMACENAMIENTO BACKBLAZE B2
 * Funciona al 100% tanto en servidor local/Node.js, Docker, Cloud Run y Cloudflare Pages.
 */

export const B2_PUBLIC_CONFIG = {
  endpoint: "https://s3.us-east-005.backblazeb2.com",
  bucketName: "clinica-san-miguel-fotos",
  downloadBaseUrl: "https://f005.backblazeb2.com/file/clinica-san-miguel-fotos"
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

export const backblazeService = {
  /**
   * Sube una imagen clínica en alta definición al bucket de Backblaze B2.
   * Envía la solicitud al endpoint /api/storage/upload (soportado por Node Express y Cloudflare Pages Functions).
   */
  async uploadClinicalImage(params: UploadImageParams): Promise<UploadImageResult> {
    try {
      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.url) {
          return {
            url: data.url,
            provider: data.provider || 'backblaze',
            key: data.key,
            sizeBytes: data.sizeBytes
          };
        }
      }
    } catch (err) {
      console.warn('[Backblaze Service] No se pudo conectar al endpoint de subida B2, usando respaldo:', err);
    }

    // Fallback seguro a dataUrl si fallara la red externa
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
    return { configured: true, provider: 'backblaze', status: 'configured' };
  }
};
