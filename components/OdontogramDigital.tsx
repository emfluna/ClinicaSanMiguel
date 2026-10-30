import React, { useState, useRef } from 'react';
import { Patient } from '../types';

type Tool = 'black' | 'red' | 'blue' | 'green' | 'white' | 'circle-red' | 'circle-blue' | 'x-blue' | 'x-red';
type Surface = 'top' | 'bottom' | 'left' | 'right' | 'center';

interface ToothDetail {
  surfaces: { [key in Surface]?: string };
  mark?: 'circle-red' | 'circle-blue' | 'x-blue' | 'x-red';
}

interface ToothState {
  [toothId: number]: ToothDetail;
}

interface ClinicalComment {
  id: string;
  text: string;
  timestamp: string;
}

interface OdontogramDigitalProps {
  patients: Patient[];
  onAssociateCapture?: (patientId: string, dataUrl: string, notes: string) => void;
}

const OdontogramDigital: React.FC<OdontogramDigitalProps> = ({ patients, onAssociateCapture }) => {
  const [currentTool, setCurrentTool] = useState<Tool>('red');
  const [toothData, setToothData] = useState<ToothState>({});
  const [comments, setComments] = useState<ClinicalComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [searchPatient, setSearchPatient] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Incrementado para mejor visibilidad y evitar que los números toquen el borde
  const toothBoxSize = 24; 

  const quadrants = [
    [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
    [55, 54, 53, 52, 51, 61, 62, 63, 64, 65],
    [85, 84, 83, 82, 81, 71, 72, 73, 74, 75],
    [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]
  ];

  const handleAction = (num: number, surface: Surface) => {
    setToothData(prev => {
      const current = prev[num] || { surfaces: {} };
      if (['circle-red', 'circle-blue', 'x-blue', 'x-red'].includes(currentTool)) {
        const newMark = current.mark === currentTool ? undefined : currentTool as any;
        return { ...prev, [num]: { ...current, mark: newMark } };
      } else if (currentTool === 'white') {
        return { ...prev, [num]: { surfaces: {}, mark: undefined } };
      } else {
        return { ...prev, [num]: { ...current, surfaces: { ...current.surfaces, [surface]: currentTool } } };
      }
    });
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    setComments([{ id: Math.random().toString(36).substr(2, 9), text: newComment, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...comments]);
    setNewComment('');
  };

  const toggleVoiceRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    if (isRecording) { recognitionRef.current?.stop(); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = true;
    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) if (event.results[i].isFinal) transcript += event.results[i][0].transcript;
      if (transcript) setNewComment(prev => prev + (prev ? ' ' : '') + transcript);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const getColorHex = (color?: string) => {
    switch (color) {
      case 'black': return '#000000';
      case 'red': return '#991b1b'; 
      case 'blue': return '#1e3a8a'; 
      case 'green': return '#14532d'; 
      default: return 'transparent';
    }
  };

  const handleCapture = () => {
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 1000;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 48px Times New Roman, serif';
    ctx.textAlign = 'center';
    ctx.fillText('ODONTOGRAMA DIGITAL', c.width / 2, 80);
    
    const drawSize = 60; 
    const horizontalGap = 16;
    const rowGap = 180;
    const startY = 240;

    quadrants.forEach((fila, rowIndex) => {
      const rowWidth = fila.length * (drawSize + horizontalGap) - horizontalGap;
      const startX = (c.width - rowWidth) / 2;
      const y = startY + (rowIndex * rowGap);

      if (rowIndex === 2) {
        ctx.setLineDash([12, 6]);
        ctx.strokeStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.moveTo(150, y - 50);
        ctx.lineTo(c.width - 150, y - 50);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      fila.forEach((num, colIndex) => {
        const x = startX + (colIndex * (drawSize + horizontalGap));
        const data = toothData[num] || { surfaces: {} };

        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 14px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(num.toString(), x + drawSize / 2, y - 15);

        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x, y, drawSize, drawSize);

        const s = drawSize / 4;

        const drawSurf = (surf: Surface) => {
          const color = data.surfaces[surf];
          ctx.fillStyle = color ? getColorHex(color) : '#ffffff';
          ctx.strokeStyle = '#f1f5f9'; 
          ctx.lineWidth = 1;

          ctx.beginPath();
          if (surf === 'top') { ctx.moveTo(x, y); ctx.lineTo(x + drawSize, y); ctx.lineTo(x + drawSize - s, y + s); ctx.lineTo(x + s, y + s); }
          else if (surf === 'left') { ctx.moveTo(x, y); ctx.lineTo(x + s, y + s); ctx.lineTo(x + s, y + drawSize - s); ctx.lineTo(x, y + drawSize); }
          else if (surf === 'right') { ctx.moveTo(x + drawSize, y); ctx.lineTo(x + drawSize - s, y + s); ctx.lineTo(x + drawSize - s, y + drawSize - s); ctx.lineTo(x + drawSize, y + drawSize); }
          else if (surf === 'bottom') { ctx.moveTo(x, y + drawSize); ctx.lineTo(x + s, y + drawSize - s); ctx.lineTo(x + drawSize - s, y + drawSize - s); ctx.lineTo(x + drawSize, y + drawSize); }
          else if (surf === 'center') { ctx.rect(x + s, y + s, drawSize - (s * 2), drawSize - (s * 2)); }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        };

        ['top', 'left', 'right', 'bottom', 'center'].forEach(s => drawSurf(s as Surface));

        if (data.mark === 'circle-red') { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x + drawSize / 2, y + drawSize / 2, drawSize / 2.2, 0, Math.PI * 2); ctx.stroke(); }
        if (data.mark === 'circle-blue') { ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x + drawSize / 2, y + drawSize / 2, drawSize / 2.2, 0, Math.PI * 2); ctx.stroke(); }
        if (data.mark === 'x-blue') { ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + drawSize, y + drawSize); ctx.moveTo(x + drawSize, y); ctx.lineTo(x, y + drawSize); ctx.stroke(); }
        if (data.mark === 'x-red') { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + drawSize, y + drawSize); ctx.moveTo(x + drawSize, y); ctx.lineTo(x, y + drawSize); ctx.stroke(); }
      });
    });

    setCapturedImage(c.toDataURL('image/png'));
    setShowPatientModal(true);
  };

  const handleDownloadPreview = () => {
    if (!capturedImage) return;
    const link = document.createElement('a');
    link.href = capturedImage;
    link.download = `Odontograma_${Date.now()}.png`;
    link.click();
  };

  const handleAssociate = (patientId: string) => {
    if (onAssociateCapture && capturedImage) {
      onAssociateCapture(patientId, capturedImage, comments.map(c => c.text).join(' | '));
      setShowPatientModal(false);
    }
  };

  return (
    <div className="p-4 lg:p-10 max-w-[1850px] mx-auto space-y-6 animate-in fade-in duration-500 pb-20 dark:bg-slate-950 min-h-full transition-all">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-4">
        <div className="flex items-center gap-4">
          <div className="size-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
            <span className="material-symbols-outlined text-3xl">dentistry</span>
          </div>
          <div className="leading-tight">
            <h2 className="text-xl lg:text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase">ODONTOGRAMA DIGITAL</h2>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">MAPA CLÍNICO INTERACTIVO</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={handleCapture} 
            className="h-12 px-8 bg-emerald-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-emerald-600/20 flex items-center gap-3 hover:bg-emerald-700 active:scale-95 transition-all border-b-4 border-emerald-800"
          >
            <span className="material-symbols-outlined text-xl">photo_camera</span> CAPTURAR MAPA
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8 items-start">
        <div className="col-span-12 lg:col-span-8 bg-slate-100/40 dark:bg-slate-900/50 rounded-[56px] p-8 border border-slate-200/60 dark:border-slate-800 flex flex-col items-center justify-center min-h-[700px] overflow-hidden shadow-inner">
          <div className="flex flex-wrap items-center justify-center gap-3 bg-white dark:bg-slate-800 p-4 rounded-[32px] border border-slate-200 dark:border-slate-700 shadow-2xl mb-12">
            {[
              { id: 'black', color: 'bg-black', label: 'AUSENTE' },
              { id: 'red', color: 'bg-[#991b1b]', label: 'CARIES' },
              { id: 'blue', color: 'bg-[#1e3a8a]', label: 'TRATAMIENTO' },
              { id: 'green', color: 'bg-[#14532d]', label: 'SELLANTE' }
            ].map(tool => (
              <button 
                key={tool.id} 
                onClick={() => setCurrentTool(tool.id as Tool)} 
                className={`size-11 rounded-xl transition-all border-4 ${currentTool === tool.id ? 'border-primary scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'} ${tool.color}`} 
                title={tool.label}
              />
            ))}
            <div className="w-px h-10 bg-slate-200 dark:bg-slate-700 mx-2"></div>
            <button onClick={() => setCurrentTool('circle-red')} className={`size-11 rounded-xl bg-white dark:bg-slate-700 border-2 flex items-center justify-center transition-all ${currentTool === 'circle-red' ? 'border-primary scale-110 shadow-lg' : 'opacity-60 hover:opacity-100'}`} title="Círculo Rojo"><div className="size-6 rounded-full border-2 border-[#991b1b]"></div></button>
            <button onClick={() => setCurrentTool('circle-blue')} className={`size-11 rounded-xl bg-white dark:bg-slate-700 border-2 flex items-center justify-center transition-all ${currentTool === 'circle-blue' ? 'border-primary scale-110 shadow-lg' : 'opacity-60 hover:opacity-100'}`} title="Círculo Azul"><div className="size-6 rounded-full border-2 border-[#1e3a8a]"></div></button>
            <button onClick={() => setCurrentTool('x-red')} className={`size-11 rounded-xl bg-white dark:bg-slate-700 border-2 flex items-center justify-center transition-all ${currentTool === 'x-red' ? 'border-primary scale-110 shadow-lg' : 'opacity-60 hover:opacity-100'}`} title="Aspa Roja"><span className="material-symbols-outlined text-red-700 text-2xl font-black leading-none">close</span></button>
            <button onClick={() => setCurrentTool('x-blue')} className={`size-11 rounded-xl bg-white dark:bg-slate-700 border-2 flex items-center justify-center transition-all ${currentTool === 'x-blue' ? 'border-primary scale-110 shadow-lg' : 'opacity-60 hover:opacity-100'}`} title="Marca X Azul"><span className="material-symbols-outlined text-blue-800 text-2xl font-black leading-none">close</span></button>
            <button onClick={() => setCurrentTool('white')} className={`size-11 rounded-xl bg-white dark:bg-slate-700 border-2 flex items-center justify-center transition-all ${currentTool === 'white' ? 'border-primary scale-110 shadow-lg' : 'opacity-60 hover:opacity-100'}`} title="Borrador"><span className="material-symbols-outlined text-rose-500 text-2xl font-black">ink_eraser</span></button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[64px] p-12 lg:p-20 w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-x-auto scrollbar-hide flex items-center justify-center">
            <div className="flex flex-col gap-12 items-center">
              {quadrants.map((fila, rowIndex) => (
                <div key={rowIndex} className={`flex justify-center gap-3 ${rowIndex === 2 ? 'mt-12 border-t border-dashed border-slate-200 dark:border-slate-700 pt-12' : ''}`}>
                  {fila.map(num => {
                    const data = toothData[num] || { surfaces: {} };
                    return (
                      <div key={num} className="flex flex-col items-center gap-2.5 group relative">
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-600 leading-none group-hover:text-primary transition-colors tracking-tighter">{num}</span>
                        <div 
                          className="relative bg-white dark:bg-slate-800 border-[2px] border-slate-950 dark:border-slate-700 rounded shadow-sm cursor-crosshair group-hover:scale-[3.8] group-hover:z-[100] group-hover:shadow-2xl group-hover:rounded-md duration-300 transition-transform" 
                          style={{ width: toothBoxSize, height: toothBoxSize }}
                        >
                          <div onClick={() => handleAction(num, 'top')} className="absolute top-0 left-0 w-full h-[30%] hover:brightness-90 border-b border-white/20 dark:border-slate-900/20" style={{ clipPath: 'polygon(0 0, 100% 0, 75% 100%, 25% 100%)', backgroundColor: getColorHex(data.surfaces.top) }} />
                          <div onClick={() => handleAction(num, 'left')} className="absolute top-0 left-0 w-[30%] h-full hover:brightness-90 border-r border-white/20 dark:border-slate-900/20" style={{ clipPath: 'polygon(0 0, 100% 25%, 100% 75%, 0 100%)', backgroundColor: getColorHex(data.surfaces.left) }} />
                          <div onClick={() => handleAction(num, 'center')} className="absolute top-[30%] left-[30%] w-[40%] h-[40%] border-[1px] border-white/30 dark:border-slate-950/30 z-10 hover:brightness-90 shadow-inner" style={{ backgroundColor: getColorHex(data.surfaces.center) }} />
                          <div onClick={() => handleAction(num, 'right')} className="absolute top-0 right-0 w-[30%] h-full hover:brightness-90 border-l border-white/20 dark:border-slate-900/20" style={{ clipPath: 'polygon(0 25%, 100% 0, 100% 100%, 0 75%)', backgroundColor: getColorHex(data.surfaces.right) }} />
                          <div onClick={() => handleAction(num, 'bottom')} className="absolute bottom-0 left-0 w-full h-[30%] hover:brightness-90 border-t border-white/20 dark:border-slate-900/20" style={{ clipPath: 'polygon(25% 0, 75% 0, 100% 100%, 0 100%)', backgroundColor: getColorHex(data.surfaces.bottom) }} />
                          
                          {data.mark && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                               {data.mark === 'circle-red' && <div className="size-[85%] border-[1.5px] border-[#ef4444] rounded-full"></div>}
                               {data.mark === 'circle-blue' && <div className="size-[85%] border-[1.5px] border-[#3b82f6] rounded-full"></div>}
                               {data.mark === 'x-blue' && <span className="material-symbols-outlined text-[#3b82f6] text-[20px] font-black leading-none">close</span>}
                               {data.mark === 'x-red' && <span className="material-symbols-outlined text-[#ef4444] text-[20px] font-black leading-none">close</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-[48px] p-10 border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col min-h-[700px] max-h-[850px]">
            <div className="flex items-center gap-4 mb-8">
              <div className="size-10 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center">
                 <span className="material-symbols-outlined">edit_document</span>
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none">Registro Clínico</h3>
            </div>
            
            <div className="relative mb-10 bg-slate-50 dark:bg-slate-800 rounded-[32px] p-2 shadow-inner focus-within:ring-4 ring-primary/10 transition-all border border-slate-100 dark:border-slate-700">
              <textarea 
                className="w-full h-36 bg-transparent border-none p-6 text-[15px] font-bold text-slate-700 dark:text-slate-300 focus:ring-0 resize-none placeholder:text-slate-400" 
                placeholder="Escribir hallazgos detectados o diagnóstico de la sesión..." 
                value={newComment} 
                onChange={e=>setNewComment(e.target.value)} 
              />
              <div className="flex justify-end p-4 gap-3">
                <button 
                  onClick={toggleVoiceRecording} 
                  className={`size-14 rounded-2xl flex items-center justify-center shadow-lg transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white dark:bg-slate-700 text-slate-400 hover:text-primary'}`} 
                  title="Dictado por voz"
                >
                  <span className="material-symbols-outlined text-3xl">mic</span>
                </button>
                <button 
                  onClick={handleAddComment} 
                  className="h-14 px-10 bg-primary text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-blue-700 active:scale-95 transition-all border-b-4 border-blue-800"
                >
                  REGISTRAR NOTA
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto scrollbar-hide pr-2">
              {comments.map(c => (
                <div key={c.id} className="p-6 bg-slate-50/50 dark:bg-slate-800/40 rounded-[36px] border border-white dark:border-slate-700 group hover:border-primary/30 transition-all shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <div className="size-2 bg-primary rounded-full"></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{c.timestamp}</span>
                    </div>
                    <button onClick={()=>setComments(prev=>prev.filter(x=>x.id!==c.id))} className="text-red-300 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"><span className="material-symbols-outlined text-base">delete</span></button>
                  </div>
                  <p className="text-[16px] font-medium text-slate-800 dark:text-slate-300 italic leading-relaxed">"{c.text}"</p>
                </div>
              ))}
              {comments.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 opacity-20 grayscale text-center">
                   <span className="material-symbols-outlined text-[64px]">list_alt</span>
                   <p className="text-[11px] font-black uppercase tracking-widest mt-4">Sin observaciones registradas</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showPatientModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-[64px] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden p-10 flex flex-col items-center border-4 border-white/10">
              <div className="w-full flex justify-between items-center mb-10">
                 <div className="flex items-center gap-5">
                    <div className="size-14 bg-emerald-500/10 text-emerald-500 rounded-3xl flex items-center justify-center shadow-inner">
                      <span className="material-symbols-outlined text-3xl">task_alt</span>
                    </div>
                    <div>
                       <h3 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none">Guardar en Ficha Clínica</h3>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">SELECCIONE EL PACIENTE CORRESPONDIENTE</p>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <button onClick={handleDownloadPreview} className="size-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center hover:bg-primary hover:text-white transition-all shadow-sm" title="Descargar Imagen"><span className="material-symbols-outlined text-2xl">download</span></button>
                    <button onClick={()=>setShowPatientModal(false)} className="size-12 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><span className="material-symbols-outlined text-2xl">close</span></button>
                 </div>
              </div>
              
              <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10">
                 <div className="lg:col-span-7 bg-slate-50 dark:bg-slate-800 rounded-[48px] p-6 border-4 border-white dark:border-slate-700 shadow-inner flex items-center justify-center overflow-hidden h-[550px]">
                    <img src={capturedImage!} className="max-w-full max-h-full object-contain rounded-3xl shadow-2xl" alt="Preview Odontograma" />
                 </div>
                 <div className="lg:col-span-5 flex flex-col min-h-[550px]">
                    <div className="relative mb-6">
                      <span className="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                      <input 
                        type="text" 
                        placeholder="Buscar por nombre o ID..." 
                        className="w-full h-16 bg-slate-100 dark:bg-slate-800 border-none rounded-[24px] pl-16 pr-6 text-sm font-black focus:ring-4 ring-primary/20 transition-all shadow-inner dark:text-white" 
                        value={searchPatient} 
                        onChange={e=>setSearchPatient(e.target.value)} 
                      />
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2 scrollbar-hide">
                      {patients.filter(p=>p.name.toLowerCase().includes(searchPatient.toLowerCase()) || p.id.includes(searchPatient)).map(p => (
                        <button 
                          key={p.id} 
                          onClick={() => handleAssociate(p.id)} 
                          className="w-full flex items-center gap-5 p-5 rounded-[32px] bg-slate-50 dark:bg-slate-800/40 hover:bg-primary/10 text-left transition-all group border-2 border-transparent hover:border-primary/20 shadow-sm"
                        >
                          <img src={p.photo} className="size-14 rounded-2xl object-cover border-2 border-white dark:border-slate-700 shadow-md group-hover:scale-110 transition-transform" />
                          <div className="flex-1">
                            <p className="text-[17px] font-black text-slate-900 dark:text-white leading-tight group-hover:text-primary transition-colors">{p.name.toUpperCase()}</p>
                            <div className="flex items-center gap-2 mt-1">
                               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-white dark:bg-slate-700 px-2 py-0.5 rounded-full border border-slate-100 dark:border-slate-600">ID: {p.id.slice(0,8)}...</span>
                            </div>
                          </div>
                          <span className="material-symbols-outlined text-primary opacity-0 group-hover:opacity-100 scale-150 transition-all">check_circle</span>
                        </button>
                      ))}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default OdontogramDigital;