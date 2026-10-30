import React, { useRef, useEffect, useState } from 'react';
import { Tooth, Patient } from '../types';

interface ToothSurfaceState {
  O: string | null;
  M: string | null;
  D: string | null;
  V: string | null;
  L: string | null;
}

interface InteractiveTooth extends Tooth {
  x_pos?: number;
  y_pos?: number;
  surfaces: ToothSurfaceState;
  comment: string;
}

interface OdontogramInteractiveProps {
  teethData?: Tooth[];
  onSaveTeeth?: (teeth: Tooth[], observations: string[]) => void;
  patients: Patient[];
  onSaveScreenshot: (patientId: string, dataUrl: string, observations: string[]) => void;
}

const OdontogramInteractive: React.FC<OdontogramInteractiveProps> = ({ teethData, onSaveTeeth, patients, onSaveScreenshot }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentColor, setCurrentColor] = useState('red');
  const [currentSurface, setCurrentSurface] = useState<keyof ToothSurfaceState>('O');
  const [teeth, setTeeth] = useState<InteractiveTooth[]>([]);
  const [history, setHistory] = useState<InteractiveTooth[][]>([]);
  const [selectedTooth, setSelectedTooth] = useState<InteractiveTooth | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [observations, setObservations] = useState<string[]>([]);
  
  // Ref para rastrear la última data cargada y evitar que el componente re-cargue 
  // la data del paciente cuando el usuario ha forzado un reset localmente.
  const lastAcknowledgedDataRef = useRef<any>(null);

  // Estados para captura y selección de paciente
  const [showPatientPicker, setShowPatientPicker] = useState(false);
  const [capturedDataUrl, setCapturedDataUrl] = useState('');
  const [searchPatient, setSearchPatient] = useState('');

  // Dimensiones del Canvas
  const toothSize = 46;
  const gap = 64;
  const canvasWidth = 1100;
  const canvasHeight = 580;

  // Genera el layout inicial completamente limpio (blanco)
  const initializeTeethLayout = () => {
    const initialTeeth: InteractiveTooth[] = [];
    
    const createRow = (numbers: number[], startX: number, startY: number) => {
      numbers.forEach((num, i) => {
        initialTeeth.push({ 
          id: num, 
          fdi: String(num), 
          status: 'healthy', 
          surfaces: { O: null, M: null, D: null, V: null, L: null },
          comment: '',
          x_pos: startX + (i * gap),
          y_pos: startY
        });
      });
    };

    // Adult Upper Arch
    createRow([18, 17, 16, 15, 14, 13, 12, 11], 35, 70);
    createRow([21, 22, 23, 24, 25, 26, 27, 28], 565, 70);
    // Pediatric Upper Arch
    createRow([55, 54, 53, 52, 51], 230, 180);
    createRow([61, 62, 63, 64, 65], 565, 180);
    
    // Pediatric Lower Arch
    createRow([85, 84, 83, 82, 81], 230, 310);
    createRow([71, 72, 73, 74, 75], 565, 310);
    // Adult Lower Arch
    createRow([48, 47, 46, 45, 44, 43, 42, 41], 35, 440);
    createRow([31, 32, 33, 34, 35, 36, 37, 38], 565, 440);

    return initialTeeth;
  };

  // Cargar datos solo cuando el paciente realmente cambia (teethData referencia distinta)
  useEffect(() => {
    if (teethData && teethData !== lastAcknowledgedDataRef.current) {
      const layout = initializeTeethLayout();
      const merged = layout.map(t => {
        const d = teethData.find(td => td.id === t.id) as any;
        if (d) {
          return { ...t, surfaces: d.surfaces || t.surfaces, comment: d.notes || d.comment || '' };
        }
        return t;
      });
      setTeeth(merged);
      lastAcknowledgedDataRef.current = teethData;
    } else if (!teethData && teeth.length === 0) {
      setTeeth(initializeTeethLayout());
    }
  }, [teethData, teeth.length]);

  const drawTeeth = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fondo blanco limpio
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Grilla estética de fondo
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1;
    for(let i=0; i<canvas.width; i+=50) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
    }

    teeth.forEach(t => {
      // Resalte de selección
      if (selectedTooth && t.id === selectedTooth.id) {
        ctx.fillStyle = '#3858fa08';
        ctx.fillRect(t.x_pos! - 5, t.y_pos! - 5, toothSize + 10, toothSize + 10);
        ctx.strokeStyle = '#3858fa';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(t.x_pos! - 5, t.y_pos! - 5, toothSize + 10, toothSize + 10);
        ctx.setLineDash([]); 
      }

      // Borde del diente (Negro sólido)
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.8;
      ctx.strokeRect(t.x_pos!, t.y_pos!, toothSize, toothSize);
      
      const s = toothSize / 4; 

      // Colorear las caras (O, M, D, V, L)
      for (const sKey in t.surfaces) {
        const color = t.surfaces[sKey as keyof ToothSurfaceState];
        if (color) {
          ctx.fillStyle = color;
          if (sKey === 'O') ctx.fillRect(t.x_pos! + s, t.y_pos! + s, s * 2, s * 2);
          if (sKey === 'M') ctx.fillRect(t.x_pos!, t.y_pos! + s, s, s * 2);
          if (sKey === 'D') ctx.fillRect(t.x_pos! + s * 3, t.y_pos! + s, s, s * 2);
          if (sKey === 'V') ctx.fillRect(t.x_pos! + s, t.y_pos!, s * 2, s);
          if (sKey === 'L') ctx.fillRect(t.x_pos! + s, t.y_pos! + s * 3, s * 2, s);
        }
      }
      
      // Etiqueta FDI (Nomenclatura)
      ctx.fillStyle = '#000000'; 
      ctx.font = '900 13px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.fdi, t.x_pos! + toothSize / 2, t.y_pos! + toothSize / 2);

      // Líneas divisorias internas (Guía)
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(t.x_pos! + s, t.y_pos! + s, s * 2, s * 2);
    });
  };

  useEffect(() => {
    drawTeeth();
  }, [teeth, selectedTooth]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    
    let clicked: InteractiveTooth | null = null;
    teeth.forEach(t => {
      if (mx >= t.x_pos! && mx <= t.x_pos! + toothSize && my >= t.y_pos! && my <= t.y_pos! + toothSize) {
        clicked = t;
      }
    });

    if (clicked) {
      setHistory(prev => [...prev, [...teeth.map(t => ({...t, surfaces: {...t.surfaces}}))]]);
      
      const updated = teeth.map(t => {
        if (t.id === (clicked as InteractiveTooth).id) {
          return {
            ...t,
            surfaces: { ...t.surfaces, [currentSurface]: currentColor === 'eraser' ? null : currentColor }
          };
        }
        return t;
      });
      setTeeth(updated);
      setSelectedTooth(updated.find(t => t.id === (clicked as InteractiveTooth).id) || null);
    } else {
      setSelectedTooth(null);
    }
  };

  /**
   * REINICIAR ODONTOGRAMA A LA FUERZA
   * Esta función es ahora extremadamente agresiva para asegurar que no quede ningún color.
   */
  const clearAll = () => {
    if (!window.confirm('¿Está seguro de reiniciar de 0 el odontograma? Todos los colores y notas se borrarán definitivamente.')) return;
    
    // 1. Forzamos un layout totalmente nuevo e independiente
    const freshLayout = initializeTeethLayout();
    
    // 2. Reseteamos todos los estados locales
    setTeeth(freshLayout);
    setHistory([]);
    setObservations([]);
    setSelectedTooth(null);
    setCommentInput('');
    
    // 3. Importante: Marcamos que hemos "procesado" un estado manual vacío
    // para que el useEffect de sincronización no intente re-inyectar los datos
    // del paciente padre a menos que el paciente cambie físicamente.
    lastAcknowledgedDataRef.current = 'manual-reset'; 
    
    // 4. Redibujado forzado del canvas
    setTimeout(() => drawTeeth(), 10);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prevState = history[history.length - 1];
    setTeeth(prevState);
    setHistory(prev => prev.slice(0, -1));
    setSelectedTooth(null);
  };

  const captureScreenshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const prevSelection = selectedTooth;
    setSelectedTooth(null); // Quitar resalte para la foto
    setTimeout(() => {
      const dataUrl = canvas.toDataURL('image/png');
      setCapturedDataUrl(dataUrl);
      setShowPatientPicker(true);
      setSelectedTooth(prevSelection);
    }, 50);
  };

  const handleConfirmAssignment = (patientId: string) => {
    if (onSaveTeeth) onSaveTeeth(teeth, observations);
    onSaveScreenshot(patientId, capturedDataUrl, observations);
    setShowPatientPicker(false);
    setCapturedDataUrl('');
  };

  const faceLabels = {
    O: 'Oclusal (O)',
    M: 'Mesial (M)',
    D: 'Distal (D)',
    V: 'Vestibular (V)',
    L: 'Lingual (L)'
  };

  return (
    <div className="p-4 max-w-[1300px] mx-auto space-y-4 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-center gap-2">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-3xl">dentistry</span>
          <h2 className="text-[28px] font-black tracking-tighter text-slate-900 leading-tight">
            Odontograma Interactivo
          </h2>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleUndo}
            disabled={history.length === 0}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 ${
              history.length === 0 
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50' 
              : 'bg-white text-slate-700 hover:bg-slate-50 shadow-slate-200/50'
            }`}
          >
            <span className="material-symbols-outlined text-lg">undo</span>
            Deshacer
          </button>
          <button 
            onClick={captureScreenshot} 
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-lg">photo_camera</span>
            Capturar y Asociar
          </button>
          <button 
            onClick={clearAll} 
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black shadow-lg transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
            Limpiar Todo
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-6 flex flex-col gap-6">
        {/* Barra de Colores */}
        <div className="flex flex-wrap items-center gap-6 pb-4 border-b border-slate-50">
          <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
            {[
              { id: 'red', color: 'bg-red-500', label: 'Caries' },
              { id: 'blue', color: 'bg-blue-500', label: 'Tratamiento' },
              { id: 'green', color: 'bg-green-500', label: 'Endodoncia' },
              { id: 'black', color: 'bg-black', label: 'Inexistente' },
              { id: 'eraser', color: 'bg-white', label: 'Borrador', icon: 'backspace' }
            ].map(tool => (
              <button
                key={tool.id}
                onClick={() => setCurrentColor(tool.id)}
                className={`size-12 rounded-xl transition-all border-4 flex items-center justify-center ${
                  currentColor === tool.id 
                  ? `${tool.id === 'eraser' ? 'border-primary ring-4 ring-primary/10' : 'border-white shadow-lg ring-4 ring-' + tool.id + '-500/30'}` 
                  : 'border-transparent opacity-60 hover:opacity-100'
                } ${tool.id !== 'eraser' ? tool.color : 'bg-white'}`}
                title={tool.label}
              >
                {tool.icon && <span className="material-symbols-outlined text-slate-400 text-xl">{tool.icon}</span>}
              </button>
            ))}
          </div>
          <div className="h-10 w-px bg-slate-200 hidden sm:block"></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pieza seleccionada: <span className="text-primary">{selectedTooth?.fdi || 'Ninguna'}</span></p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Selector de Cara */}
          <div className="lg:w-48 bg-slate-50/50 rounded-[28px] p-4 border border-slate-100 flex flex-col gap-2">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-2">Cara Activa</h3>
            {Object.entries(faceLabels).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setCurrentSurface(key as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all border-2 ${
                  currentSurface === key 
                    ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20 scale-105' 
                    : 'bg-white border-transparent text-slate-400 hover:border-slate-200 hover:text-slate-600'
                }`}
              >
                <div className={`size-5 rounded-md flex items-center justify-center font-black ${currentSurface === key ? 'bg-white text-primary' : 'bg-slate-100'}`}>
                  {key}
                </div>
                {label.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Área del Odontograma (Canvas) */}
          <div className="flex-1 bg-slate-50/30 rounded-[32px] p-4 border border-slate-100/50 flex justify-center items-center shadow-inner overflow-hidden">
            <div className="bg-white border-4 border-white rounded-[24px] shadow-2xl overflow-hidden">
              <canvas 
                ref={canvasRef} 
                width={canvasWidth} 
                height={canvasHeight} 
                onClick={handleCanvasClick}
                className="cursor-crosshair w-full h-auto"
                style={{ maxWidth: '100%', maxHeight: '600px' }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Mapa de Diagnóstico */}
          <div className="lg:col-span-1 bg-slate-50/80 rounded-[32px] p-8 border border-slate-100 space-y-6">
             <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-3">Leyenda de Diagnóstico</h3>
             <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="size-6 bg-red-500 rounded-lg shadow-sm"></div>
                  <span className="text-xs font-black text-slate-600 uppercase tracking-wider">Caries / Patología</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="size-6 bg-blue-500 rounded-lg shadow-sm"></div>
                  <span className="text-xs font-black text-slate-600 uppercase tracking-wider">Tratamiento Existente</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="size-6 bg-green-500 rounded-lg shadow-sm"></div>
                  <span className="text-xs font-black text-slate-600 uppercase tracking-wider">Procedimiento Especial</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="size-6 bg-black rounded-lg shadow-sm"></div>
                  <span className="text-xs font-black text-slate-600 uppercase tracking-wider">Inexistente</span>
                </div>
             </div>
          </div>

          {/* Observaciones */}
          <div className="lg:col-span-2 bg-slate-50/80 rounded-[32px] p-8 border border-slate-100 flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">edit_note</span>
                Observaciones de Sesión
              </h3>
            </div>
            
            <textarea 
              className="w-full h-20 bg-white border-none rounded-[20px] p-6 text-sm font-bold text-slate-700 shadow-inner focus:ring-4 focus:ring-primary/5 resize-none placeholder:text-slate-300 transition-all"
              placeholder="Describa el hallazgo clínico..."
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), setObservations([commentInput.trim(), ...observations]), setCommentInput(''))}
            />
            
            <div className="flex justify-end gap-3">
               <button 
                onClick={() => { if(commentInput.trim()) { setObservations([commentInput.trim(), ...observations]); setCommentInput(''); } }}
                className="px-10 py-3 bg-primary text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
               >
                 Guardar Nota
               </button>
            </div>

            {observations.length > 0 && (
              <div className="space-y-3 mt-2 border-t border-slate-200 pt-6">
                <div className="max-h-40 overflow-y-auto pr-2 space-y-2 scrollbar-hide">
                  {observations.map((obs, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center group shadow-sm transition-all hover:border-slate-200">
                      <p className="text-[13px] font-bold text-slate-700 flex-1">{obs}</p>
                      <button onClick={() => setObservations(prev => prev.filter((_, i) => i !== idx))} className="text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all ml-4">
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Vinculación */}
      {showPatientPicker && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl rounded-[50px] shadow-2xl overflow-hidden border-[10px] border-white/90 animate-in zoom-in duration-200">
            <div className="p-10 border-b border-slate-100 flex flex-col items-center bg-slate-50 text-center">
              <div className="size-20 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 shadow-xl border border-emerald-100/50">
                 <span className="material-symbols-outlined text-4xl">person_add</span>
              </div>
              <h3 className="text-2xl font-black text-slate-900">Vincular Registro</h3>
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="aspect-[1.6/1] rounded-[32px] overflow-hidden border-2 border-slate-100 shadow-xl bg-white p-2">
                  <img src={capturedDataUrl} className="w-full h-full object-contain rounded-[24px]" alt="Captured Map" />
                </div>
                <div className="bg-slate-50 rounded-[32px] p-6 border border-slate-100 max-h-[250px] overflow-y-auto scrollbar-hide shadow-inner">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Notas de la Sesión:</h4>
                   {observations.length > 0 ? (
                     <div className="space-y-3">
                        {observations.map((obs, i) => (
                          <div key={i} className="flex gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                             <span className="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                             <p className="text-[12px] font-bold text-slate-600 italic">{obs}</p>
                          </div>
                        ))}
                     </div>
                   ) : (
                     <p className="text-[11px] text-slate-300 font-black uppercase text-center py-10">Sin notas registradas</p>
                   )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-primary text-xl">search</span>
                  <input 
                    type="text" 
                    placeholder="Buscar paciente..."
                    className="w-full h-14 bg-slate-50 border-none rounded-2xl pl-14 pr-6 text-sm font-black focus:ring-4 focus:ring-primary/10 transition-all shadow-inner"
                    value={searchPatient}
                    onChange={(e) => setSearchPatient(e.target.value)}
                  />
                </div>

                <div className="max-h-[350px] overflow-y-auto pr-2 space-y-2 scrollbar-hide">
                  {patients.filter(p => p.name.toLowerCase().includes(searchPatient.toLowerCase()) || p.id.includes(searchPatient)).map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleConfirmAssignment(p.id)}
                      className="w-full flex items-center gap-4 p-4 rounded-3xl border-2 border-transparent bg-white hover:border-primary hover:bg-primary/5 transition-all text-left group shadow-sm"
                    >
                      <img src={p.photo} className="size-12 rounded-2xl object-cover shadow-lg group-hover:scale-110 transition-transform" />
                      <div className="flex-1">
                        <p className="text-lg font-black text-slate-900 group-hover:text-primary truncate">{p.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1 flex items-center gap-1">
                          ID: {p.id}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-primary opacity-0 group-hover:opacity-100 scale-125">check_circle</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-10 pt-0 flex gap-4">
               <button 
                onClick={() => setShowPatientPicker(false)}
                className="flex-1 h-14 border-4 border-slate-100 text-slate-400 font-black rounded-[24px] uppercase tracking-widest text-[11px] hover:bg-slate-50 hover:text-slate-600 transition-all"
               >
                 Cancelar
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OdontogramInteractive;