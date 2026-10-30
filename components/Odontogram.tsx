
import React from 'react';
import { Tooth, ToothStatus } from '../types';

interface OdontogramProps {
  teeth: Tooth[];
  onUpdateTooth: (fdi: string, status: ToothStatus) => void;
  activeTool?: ToothStatus;
}

const ToothSVG: React.FC<{ type: 'molar' | 'premolar' | 'canine' | 'incisor', status: ToothStatus, isUpper: boolean }> = ({ type, status, isUpper }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'cavity': return '#ef4444'; // Rojo (Caries)
      case 'filling': return '#3858fa'; // Azul (Obturación/Resina)
      case 'brackets': return '#10b981'; // Verde (Ortodoncia)
      case 'implant': return '#64748b'; // Slate (Implante)
      case 'veneer': return '#22d3ee'; // Cyan (Carilla)
      case 'crown': return '#f59e0b'; // Amber (Corona)
      case 'bridge': return '#8b5cf6'; // Violeta (Puente)
      case 'extraction': return '#f43f5e'; // Rose (Extracción indicada)
      case 'missing': return 'transparent';
      case 'other': return '#475569';
      default: return '#f8fafc';
    }
  };

  const color = getStatusColor();
  const strokeColor = (status === 'missing' || status === 'extraction') ? '#cbd5e1' : '#94a3b8';
  const rotation = isUpper ? '' : 'rotate(180 25 25)';

  const renderPath = () => {
    switch (type) {
      case 'molar':
        return <path d="M10,15 Q10,10 15,10 L35,10 Q40,10 40,15 L42,35 Q42,42 35,42 L15,42 Q8,42 8,35 Z" fill={color} stroke={strokeColor} strokeWidth="1.5" />;
      case 'premolar':
        return <path d="M12,15 Q12,10 18,10 L32,10 Q38,10 38,15 L39,38 Q39,42 32,42 L18,42 Q11,42 11,38 Z" fill={color} stroke={strokeColor} strokeWidth="1.5" />;
      case 'canine':
        return <path d="M15,42 L12,30 Q12,10 25,5 Q38,10 38,30 L35,42 Z" fill={color} stroke={strokeColor} strokeWidth="1.5" />;
      case 'incisor':
        return <path d="M12,42 L10,15 Q10,10 25,10 Q40,10 40,15 L38,42 Z" fill={color} stroke={strokeColor} strokeWidth="1.5" />;
    }
  };

  return (
    <svg viewBox="0 0 50 50" className="w-full h-full drop-shadow-sm transition-all duration-300">
      <g transform={rotation}>
        {renderPath()}
        {status === 'missing' && (
          <path d="M10,10 L40,40 M40,10 L10,40" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
        )}
        {status === 'extraction' && (
          <path d="M10,10 L40,40 M40,10 L10,40" stroke="#f43f5e" strokeWidth="4" strokeLinecap="round" />
        )}
        {status === 'implant' && (
          <path d="M25,25 L25,48 M18,30 L32,30 M18,36 L32,36 M18,42 L32,42" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
        )}
        {status === 'brackets' && (
          <g stroke="#10b981" strokeWidth="2" fill="none">
            <rect x="18" y="20" width="14" height="10" rx="1" />
            <path d="M10,25 L40,25" />
          </g>
        )}
        {status === 'veneer' && (
          <path d="M12,15 L12,40 Q25,45 38,40 L38,15" fill="none" stroke="#06b6d4" strokeWidth="3" />
        )}
        {status === 'crown' && (
          <path d="M8,15 L8,12 Q25,5 42,12 L42,15" fill="none" stroke="#d97706" strokeWidth="4" />
        )}
        {status === 'bridge' && (
          <path d="M2,25 L48,25" stroke="#8b5cf6" strokeWidth="5" strokeLinecap="round" opacity="0.6" />
        )}
        {status === 'cavity' && (
          <circle cx="25" cy="25" r="6" fill="#991b1b" />
        )}
      </g>
    </svg>
  );
};

const ToothComponent: React.FC<{ tooth: Tooth; onClick: () => void; activeTool?: ToothStatus }> = ({ tooth, onClick, activeTool }) => {
  const fdiNum = parseInt(tooth.fdi);
  
  const getToothType = (): 'molar' | 'premolar' | 'canine' | 'incisor' => {
    const pos = fdiNum % 10;
    if (pos >= 6) return 'molar';
    if (pos >= 4) return 'premolar';
    if (pos === 3) return 'canine';
    return 'incisor';
  };

  const isUpper = fdiNum < 30;

  return (
    <div 
      onClick={onClick}
      className="tooth-container group flex flex-col items-center gap-1 cursor-pointer transition-all active:scale-90"
    >
      <span className="text-[9px] text-slate-400 font-black mb-0.5 group-hover:text-primary transition-colors">{tooth.fdi}</span>
      <div className="w-11 h-14 relative flex items-center justify-center p-1 bg-white rounded-xl border border-transparent group-hover:border-primary/20 group-hover:bg-primary/5 transition-all">
        <ToothSVG type={getToothType()} status={tooth.status} isUpper={isUpper} />
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 transition-opacity">
          Pieza {tooth.fdi}
        </div>
      </div>
    </div>
  );
};

const Odontogram: React.FC<OdontogramProps> = ({ teeth, onUpdateTooth, activeTool }) => {
  const q1 = teeth.filter(t => parseInt(t.fdi) >= 11 && parseInt(t.fdi) <= 18).sort((a,b) => parseInt(b.fdi) - parseInt(a.fdi));
  const q2 = teeth.filter(t => parseInt(t.fdi) >= 21 && parseInt(t.fdi) <= 28).sort((a,b) => parseInt(a.fdi) - parseInt(b.fdi));
  const q3 = teeth.filter(t => parseInt(t.fdi) >= 31 && parseInt(t.fdi) <= 38).sort((a,b) => parseInt(a.fdi) - parseInt(b.fdi));
  const q4 = teeth.filter(t => parseInt(t.fdi) >= 41 && parseInt(t.fdi) <= 48).sort((a,b) => parseInt(b.fdi) - parseInt(a.fdi));

  const handleToothClick = (tooth: Tooth) => {
    if (activeTool) {
      const newStatus = tooth.status === activeTool ? 'healthy' : activeTool;
      onUpdateTooth(tooth.fdi, newStatus);
    }
  };

  return (
    <div className="flex flex-col items-center gap-12 py-10 bg-white/40 rounded-[40px] border border-slate-100/50 backdrop-blur-sm shadow-inner">
      <div className="flex flex-col items-center gap-4">
        <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-2">Arcada Superior</span>
        <div className="flex gap-4 justify-center items-end select-none">
          <div className="flex gap-1.5">{q1.map(t => <ToothComponent key={t.fdi} tooth={t} activeTool={activeTool} onClick={() => handleToothClick(t)} />)}</div>
          <div className="w-px h-16 bg-slate-200/60 mx-2 self-center"></div>
          <div className="flex gap-1.5">{q2.map(t => <ToothComponent key={t.fdi} tooth={t} activeTool={activeTool} onClick={() => handleToothClick(t)} />)}</div>
        </div>
      </div>

      <div className="w-full max-w-2xl h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>

      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-4 justify-center items-start select-none">
          <div className="flex gap-1.5">{q4.map(t => <ToothComponent key={t.fdi} tooth={t} activeTool={activeTool} onClick={() => handleToothClick(t)} />)}</div>
          <div className="w-px h-16 bg-slate-200/60 mx-2 self-center"></div>
          <div className="flex gap-1.5">{q3.map(t => <ToothComponent key={t.fdi} tooth={t} activeTool={activeTool} onClick={() => handleToothClick(t)} />)}</div>
        </div>
        <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mt-2">Arcada Inferior</span>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-x-8 gap-y-4 px-10">
        {[
          { color: 'bg-red-500', label: 'Caries' },
          { color: 'bg-primary', label: 'Resina' },
          { color: 'bg-cyan-400', label: 'Carilla' },
          { color: 'bg-amber-500', label: 'Corona' },
          { color: 'bg-violet-500', label: 'Puente' },
          { color: 'bg-rose-500', label: 'Extracción' },
          { color: 'bg-slate-500', label: 'Implante' },
          { color: 'bg-emerald-500', label: 'Ortodoncia' },
          { color: 'bg-slate-200', border: 'border-slate-300', label: 'Ausente' }
        ].map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className={`size-3 rounded-sm ${item.color} ${item.border || ''} border`}></div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Odontogram;
