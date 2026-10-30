
import React, { useState } from 'react';
import { aiService } from '../services/aiService';
import MarketingGenerator from './MarketingGenerator';

const AiAssistant: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'clinical' | 'marketing'>('clinical');
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    const result = await aiService.askAssistant(prompt);
    setResponse(result || '');
    setIsLoading(false);
  };

  const quickQueries = [
    "Dosis de Amoxicilina en niños",
    "Protocolo post-extracción",
    "Diferencia entre carillas de resina vs cerámica",
    "Riesgos de cirugía en pacientes hipertensos"
  ];

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      {/* HEADER UNIFICADO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="size-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <span className="material-symbols-outlined animate-pulse text-2xl">auto_awesome</span>
            </div>
            <h2 className="text-4xl font-black tracking-tighter text-slate-900 leading-none">Asistente IA SM</h2>
          </div>
          <p className="text-slate-500 font-bold mt-2 uppercase tracking-widest text-[10px] bg-white px-4 py-1.5 rounded-full w-fit border border-slate-100 shadow-sm">
            Ecosistema de Inteligencia Artificial San Miguel
          </p>
        </div>

        {/* SELECTOR DE PESTAÑAS */}
        <div className="bg-slate-100 p-1.5 rounded-[24px] flex gap-1">
          <button 
            onClick={() => setActiveTab('clinical')}
            className={`px-8 py-3 rounded-[20px] text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'clinical' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <span className="material-symbols-outlined text-lg">clinical_notes</span>
            Asistente Clínico
          </button>
          <button 
            onClick={() => setActiveTab('marketing')}
            className={`px-8 py-3 rounded-[20px] text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'marketing' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <span className="material-symbols-outlined text-lg">campaign</span>
            Márketing RRSS
          </button>
        </div>
      </div>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>

      {activeTab === 'clinical' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4 duration-500">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-[40px] p-10 border border-slate-200 shadow-sm">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-8 border-b border-slate-50 pb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">quiz</span> CONSULTAS RÁPIDAS
              </h3>
              <div className="space-y-3">
                {quickQueries.map((q, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setPrompt(q)}
                    className="w-full text-left p-5 rounded-3xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all flex items-center justify-between group"
                  >
                    <span className="flex-1">{q}</span>
                    <span className="material-symbols-outlined text-indigo-300 opacity-0 group-hover:opacity-100 transition-all">chevron_right</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[40px] p-10 text-white shadow-xl relative overflow-hidden group">
              <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-[140px] text-white/10 group-hover:scale-110 transition-transform">neurology</span>
              <h4 className="text-2xl font-black mb-4 tracking-tight">Potenciado por Gemini</h4>
              <p className="text-[13px] text-indigo-100 font-bold leading-relaxed opacity-80">
                Optimice sus decisiones clínicas con apoyo de modelos de lenguaje avanzados diseñados para profesionales de la salud.
              </p>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-[48px] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[600px] relative">
              <div className="flex-1 p-10 lg:p-14 overflow-y-auto space-y-8 scrollbar-hide">
                {!response && !isLoading ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-20">
                    <span className="material-symbols-outlined text-[100px] font-light" style={{ fontVariationSettings: "'wght' 100" }}>forum</span>
                    <p className="font-black uppercase tracking-[0.3em] text-[13px] mt-8">Esperando su consulta clínica...</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {isLoading ? (
                      <div className="space-y-6 animate-pulse">
                        <div className="h-5 bg-slate-100 rounded-full w-3/4"></div>
                        <div className="h-5 bg-slate-100 rounded-full w-1/2"></div>
                        <div className="h-5 bg-slate-100 rounded-full w-5/6"></div>
                        <div className="h-5 bg-slate-100 rounded-full w-2/3"></div>
                      </div>
                    ) : (
                      <div className="prose prose-slate max-w-none animate-in fade-in zoom-in duration-300">
                        <div className="bg-slate-50 p-10 rounded-[40px] border border-slate-100 shadow-inner relative overflow-hidden">
                          <span className="material-symbols-outlined absolute -top-4 -left-4 text-[80px] text-indigo-100/50">format_quote</span>
                          <p className="text-[16px] font-medium text-slate-800 leading-loose whitespace-pre-wrap relative z-10">
                            {response}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-8 bg-slate-100/50 border-t border-slate-200">
                <form onSubmit={handleAsk} className="relative">
                  <input 
                    type="text"
                    placeholder="¿Cuál es su duda clínica hoy?"
                    className="w-full h-20 bg-white border-none rounded-[32px] px-10 pr-20 text-[16px] font-bold shadow-xl shadow-slate-200/50 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-300"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                  <button 
                    type="submit"
                    disabled={isLoading || !prompt.trim()}
                    className="absolute right-3 top-3 size-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/30 disabled:opacity-50 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-2xl">send</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-in slide-in-from-bottom-4 duration-500">
          <MarketingGenerator />
        </div>
      )}
    </div>
  );
};

export default AiAssistant;
