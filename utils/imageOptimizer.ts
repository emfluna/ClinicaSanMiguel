/**
 * Optimizador de Imágenes Clínicas en Alta Definición para Dental San Miguel
 * 
 * Diseñado específicamente para preservar:
 * - Textos y letras legibles (recetas, exámenes, consentimientos, notas impresas)
 * - Líneas anatómicas finas y contraste vascular (venas, conductos, fisuras)
 * 
 * Estrategia de preservación y eficiencia (Protección de Cuota Gratuita Supabase):
 * 1. Resolución máxima de 2048px (suficiente para lectura nítida de letras y venas).
 * 2. Compresión moderna WebP (calidad 84%), la cual preserva bordes afilados sin
 *    los artefactos de bloque de JPEG. Fallback automático a JPEG de alta fidelidad si fuese necesario.
 * 3. Algoritmo de reducción por pasos (multi-step downsampling) con 'imageSmoothingQuality = high'
 *    para evitar pérdida de líneas finas (aliasing).
 * 4. Peso final por imagen de solo ~150 KB - 280 KB (vs 5-10 MB de fotos crudas).
 *    En el límite gratuito de 500 MB de Supabase, permite almacenar más de 2,500 fotos clínicas completas.
 */

export interface OptimizedImageResult {
  dataUrl: string;
  width: number;
  height: number;
  approxKb: number;
  format: string;
}

export const optimizeClinicalImage = async (
  file: File | Blob,
  maxDimension: number = 2560,
  quality: number = 0.90
): Promise<OptimizedImageResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo procesar la imagen'));
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Si la imagen ya es pequeña (ej. < 2048px), no la agrandamos
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        // Crear canvas inicial con las dimensiones originales
        let currentCanvas = document.createElement('canvas');
        currentCanvas.width = img.naturalWidth || img.width;
        currentCanvas.height = img.naturalHeight || img.height;
        const initialCtx = currentCanvas.getContext('2d');
        if (!initialCtx) {
          reject(new Error('Canvas 2D no disponible'));
          return;
        }

        initialCtx.drawImage(img, 0, 0);

        // Si la imagen original es más del doble de grande que el objetivo,
        // reducir a la mitad por pasos para conservar trazos delgados (como venas o fuentes finas)
        let curW = currentCanvas.width;
        let curH = currentCanvas.height;

        while (curW / 2 >= width && curH / 2 >= height) {
          const nextW = Math.floor(curW / 2);
          const nextH = Math.floor(curH / 2);
          const nextCanvas = document.createElement('canvas');
          nextCanvas.width = nextW;
          nextCanvas.height = nextH;
          const nextCtx = nextCanvas.getContext('2d');
          if (!nextCtx) break;
          nextCtx.imageSmoothingEnabled = true;
          nextCtx.imageSmoothingQuality = 'high';
          nextCtx.drawImage(currentCanvas, 0, 0, nextW, nextH);
          currentCanvas = nextCanvas;
          curW = nextW;
          curH = nextH;
        }

        // Canvas final de destino
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = width;
        finalCanvas.height = height;
        const finalCtx = finalCanvas.getContext('2d');
        if (!finalCtx) {
          reject(new Error('Canvas final no disponible'));
          return;
        }

        finalCtx.imageSmoothingEnabled = true;
        finalCtx.imageSmoothingQuality = 'high';
        finalCtx.drawImage(currentCanvas, 0, 0, width, height);

        // Intentar exportar en WebP (máxima preservación de bordes para letras y venas)
        let format = 'image/webp';
        let dataUrl = finalCanvas.toDataURL('image/webp', quality);

        // Fallback a JPEG si el navegador no soporta exportación WebP
        if (!dataUrl.startsWith('data:image/webp')) {
          format = 'image/jpeg';
          dataUrl = finalCanvas.toDataURL('image/jpeg', Math.min(0.85, quality));
        }

        const base64Index = dataUrl.indexOf(',');
        const approxBytes = base64Index >= 0 ? Math.round(((dataUrl.length - base64Index) * 3) / 4) : dataUrl.length;
        const approxKb = Math.round(approxBytes / 1024);

        resolve({
          dataUrl,
          width,
          height,
          approxKb,
          format
        });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};
