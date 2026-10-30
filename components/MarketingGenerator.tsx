import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";

const MarketingGenerator: React.FC = () => {
  const [offerText, setOfferText] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestedCopy, setSuggestedCopy] = useState('');

  const generateContent = async () => {
    if (!offerText.trim()) return;
    setIsGenerating(true);
    setGeneratedImage(null);
    setSuggestedCopy('');

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
      // 1. Generar Copy Persuasivo
      const copyResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Eres un experto en marketing dental. Crea un copy persuasivo para redes sociales (Instagram/Facebook) para la siguiente oferta en la Clínica San Miguel: "${offerText}". Incluye emojis y llamados a la acción potentes.`,
      });
      setSuggestedCopy(copyResponse.text || '');

      // 2. Generar Imagen con gemini-2.5-flash-image
      const imagePrompt = `Professional and aesthetic high-quality social media ad image for a dental clinic. Feature: ${offerText}. High-end dental setting, bright lighting, healthy white smile, modern professional feel, minimalist and clean background. Photorealistic.`;
      
      // Fix: Use correct string format for contents as per @google/genai guidelines
      const imageResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: imagePrompt,
      });

      for (const part of imageResponse.candidates[0].content.parts) {
        if (part.inlineData) {
          setGeneratedImage(`data:image/png;base64,${part.inlineData.data}`);
          break;
        }
      }
    } catch (error) {
      console.error("Error generating marketing content:", error);
      alert("Error al generar el contenido. Verifique su conexión y API Key.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `Promocion_SM_${new Date().toLocaleDateString()}.png`;
    link.click();
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500 pb-24">
      <div className="space-y-1">
        <h2 className="text-[42px] font-black tracking-tighter text-slate-900 leading-none">Generador de Contenido RRSS</h2>
        <p className="text-slate-500 font-black uppercase tracking-[0.15em] text-[11px] mt-2 bg-white border border-slate-200 px-4 py-1.5 rounded-full w-fit shadow-sm">
          CREA IMÁGENES Y OFERTAS DIARIAS CON INTELIGENCIA ARTIFICIAL
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* PANEL DE CONTROL */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm space-y-8">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">¿QUÉ DESEAS PROMOCIONAR HOY?</label>
              <textarea 
                className="w-full h-40 bg-slate-50 border-none rounded-[32px] p-8 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-primary/5 resize-none shadow-inner placeholder:text-slate-300"
                placeholder="Ej: Oferta de Blanqueamiento LED 2x1 solo por este mes en San Miguel..."
                value={offerText}
                onChange={(e) => setOfferText(e.target.value)}
              />
            </div>
            
            <button 
              onClick={generateContent}
              disabled={isGenerating || !offerText.trim()}
              className="w-full h-16 bg-primary text-white rounded-[24px] font-black text-[12px] uppercase tracking-widest shadow-xl shadow-primary/30 flex items-center justify-center gap-3 hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <span className="material-symbols-outlined animate-spin">sync</span>
                  GENERANDO...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">auto_awesome</span>
                  GENERAR CONTENIDO
                </>
              )}
            </button>
          </div>

          {suggestedCopy && (
            <div className="bg-slate-900 text-white rounded-[40px] p-8 shadow-xl relative overflow-hidden group animate-in slide-in-from-left-4">
              <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-[100px] text-white/5 group-hover:scale-110 transition-transform">chat</span>
              <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">TEXTO SUGERIDO (RRSS)</h3>
              <div className="bg-white/5 p-6 rounded-[24px] border border-white/10">
                <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap italic">"{suggestedCopy}"</p>
              </div>
              <button 
                onClick={() => navigator.clipboard.writeText(suggestedCopy)}
                className="mt-6 text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-widest flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">content_copy</span> COPIAR TEXTO
              </button>
            </div>
          )}
        </div>

        {/* VISTA PREVIA */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-[56px] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full min-h-[600px] relative">
            {!generatedImage && !isGenerating ? (
              <div className="flex-1 flex flex-col items-center justify-center p-20 opacity-20 text-center grayscale">
                <span className="material-symbols-outlined text-[120px] font-light">image</span>
                <p className="font-black uppercase tracking-[0.3em] mt-8 text-sm">La vista previa de su anuncio aparecerá aquí</p>
              </div>
            ) : isGenerating ? (
              <div className="flex-1 flex flex-col items-center justify-center p-20">
                <div className="size-24 border-8 border-slate-100 border-t-primary rounded-full animate-spin"></div>
                <p className="mt-8 font-black text-slate-400 uppercase tracking-widest animate-pulse">Nuestra IA está diseñando su oferta...</p>
              </div>
            ) : (
              <div className="flex-1 p-10 flex flex-col gap-8 animate-in zoom-in duration-500">
                <div className="flex-1 relative rounded-[40px] overflow-hidden shadow-2xl border-[12px] border-slate-50">
                  <img src={generatedImage!} className="w-full h-full object-cover" alt="Marketing Content" />
                  <div className="absolute top-8 left-8 bg-white/90 backdrop-blur px-5 py-2 rounded-full shadow-lg border border-white/50 flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-xl">verified</span>
                    <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest">San Miguel Dental</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center bg-slate-50 p-6 rounded-[32px] border border-slate-100 shadow-inner">
                  <div className="flex gap-4">
                    <button 
                      onClick={generateContent}
                      className="h-14 px-8 bg-white text-slate-700 font-black rounded-2xl border border-slate-200 hover:border-primary hover:text-primary transition-all shadow-sm flex items-center gap-3"
                    >
                      <span className="material-symbols-outlined">refresh</span>
                      NUEVO DISEÑO
                    </button>
                  </div>
                  <button 
                    onClick={downloadImage}
                    className="h-14 px-10 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-500/30 hover:bg-emerald-700 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3"
                  >
                    <span className="material-symbols-outlined">download</span>
                    DESCARGAR PARA RRSS
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketingGenerator;