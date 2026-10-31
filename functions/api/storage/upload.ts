/**
 * Cloudflare Pages Function: /api/storage/upload
 * Permite subir fotos clínicas a Backblaze B2 directamente cuando el app corre en Cloudflare Pages
 */

const DEFAULT_B2_BUCKET = "dental-san-miguel-fotos";
const DEFAULT_B2_KEY_ID = "d30d02d5df98";
const DEFAULT_B2_APP_KEY = "0052c6253e9e3c8e5531378841c98b27a65e2e6e20";

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

async function sha1Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-1", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestPost(context: any) {
  try {
    const body: any = await context.request.json();
    const { dataUrl, patientId, patientName, mimeType } = body || {};

    if (!dataUrl || typeof dataUrl !== "string") {
      return new Response(JSON.stringify({ error: "No se proporcionó imagen válida" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const env = context.env || {};
    const keyId = env.B2_KEY_ID?.trim() || DEFAULT_B2_KEY_ID;
    const appKey = env.B2_APPLICATION_KEY?.trim() || DEFAULT_B2_APP_KEY;
    const bucketName = env.B2_BUCKET_NAME?.trim() || DEFAULT_B2_BUCKET;

    // 1. Autorizar con Backblaze B2
    const basicAuth = btoa(`${keyId}:${appKey}`);
    const authRes = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
      headers: { Authorization: `Basic ${basicAuth}` }
    });

    if (!authRes.ok) {
      const errTxt = await authRes.text();
      return new Response(JSON.stringify({
        success: true,
        url: dataUrl,
        provider: "fallback_direct",
        warning: "B2 Auth Error en Cloudflare, usando fallback: " + errTxt
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const authData: any = await authRes.json();
    const apiUrl = authData.apiInfo?.storageApi?.apiUrl;
    const downloadUrl = authData.apiInfo?.storageApi?.downloadUrl || "https://f005.backblazeb2.com";
    const authToken = authData.authorizationToken;
    const accountId = authData.accountId;

    let bucketId = authData.allowed?.bucketId;

    if (!bucketId) {
      // 2. Obtener bucketId si no vino restringido en las credenciales
      try {
        const bucketRes = await fetch(`${apiUrl}/b2api/v3/b2_list_buckets`, {
          method: "POST",
          headers: {
            Authorization: authToken,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ accountId, bucketName })
        });

        if (bucketRes.ok) {
          const bucketData: any = await bucketRes.json();
          const bucket = bucketData.buckets?.find((b: any) => b.bucketName === bucketName);
          bucketId = bucket?.bucketId;
        }
      } catch (e) {
        console.warn("b2_list_buckets skipped or failed:", e);
      }
    }

    if (!bucketId) {
      return new Response(JSON.stringify({
        success: true,
        url: dataUrl,
        provider: "fallback_direct",
        warning: `Bucket ${bucketName} no encontrado en la cuenta Backblaze.`
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. Obtener upload url
    const upUrlRes = await fetch(`${apiUrl}/b2api/v3/b2_get_upload_url`, {
      method: "POST",
      headers: {
        Authorization: authToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ bucketId })
    });

    if (!upUrlRes.ok) {
      return new Response(JSON.stringify({ success: true, url: dataUrl, provider: "fallback_direct" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const upUrlData: any = await upUrlRes.json();

    // 4. Preparar archivo binario desde Base64
    let base64 = dataUrl;
    let contentType = mimeType || "image/webp";

    if (dataUrl.includes(",")) {
      const parts = dataUrl.split(",");
      const match = parts[0].match(/:(.*?);/);
      if (match) contentType = match[1];
      base64 = parts[1];
    }

    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const sha1 = await sha1Hex(bytes.buffer);
    const folderName = formatPatientFolderName(patientName, patientId);
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

    if (!uploadRes.ok) {
      return new Response(JSON.stringify({ success: true, url: dataUrl, provider: "fallback_direct" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const uploadData: any = await uploadRes.json();
    const finalUrl = `${downloadUrl}/file/${bucketName}/${uploadData.fileName}`;

    return new Response(JSON.stringify({
      success: true,
      url: finalUrl,
      provider: "backblaze",
      key: uploadData.fileName,
      sizeBytes: bytes.length,
      platform: "cloudflare_pages"
    }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message || "Error interno en Cloudflare Pages Function"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
