/**
 * Cloudflare Pages Function: /api/storage/status
 */

const DEFAULT_B2_BUCKET = "clinica-san-miguel-fotos";
const DEFAULT_B2_KEY_ID = "005d30d02d5df980000000002";
const DEFAULT_B2_APP_KEY = "K005VH4caGLzGOScLY6CudpUZqNUdKc";

export async function onRequestGet(context: any) {
  try {
    const env = context.env || {};
    const keyId = env.B2_KEY_ID?.trim() || DEFAULT_B2_KEY_ID;
    const appKey = env.B2_APPLICATION_KEY?.trim() || DEFAULT_B2_APP_KEY;
    const bucketName = env.B2_BUCKET_NAME?.trim() || DEFAULT_B2_BUCKET;

    const basicAuth = btoa(`${keyId}:${appKey}`);
    const authRes = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
      headers: { Authorization: `Basic ${basicAuth}` }
    });

    if (authRes.ok) {
      return new Response(JSON.stringify({
        configured: true,
        provider: "backblaze",
        bucketName,
        status: "connected",
        platform: "cloudflare_pages",
        message: `Backblaze B2 conectado y listo en Cloudflare (Bucket: ${bucketName}).`
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      configured: true,
      provider: "backblaze",
      bucketName,
      status: "configured",
      platform: "cloudflare_pages",
      message: `Credenciales de Backblaze configuradas en Cloudflare para ${bucketName}.`
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({
      configured: false,
      error: err.message
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
