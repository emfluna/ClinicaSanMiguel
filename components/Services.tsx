
import React, { useState, useMemo } from 'react';
import { ClinicalService, InventoryNote } from '../types';

interface ServicesProps {
  services: ClinicalService[];
  onAddService: (service: ClinicalService) => void;
  onUpdateService: (id: string, updates: Partial<ClinicalService>) => void;
  onDeleteService: (id: string) => void;
  inventoryNotes: InventoryNote[];
  onAddInventoryNote: (text: string) => void;
  onDeleteInventoryNote: (id: string) => void;
  onToggleInventoryComplete: (id: string) => void;
}

const getServicePalette = (index: number) => {
  const palettes = [
    { 
      // Blue - Limpieza
      card: 'bg-[#0f172a] border-blue-500/30 hover:border-blue-500/60 shadow-[0_0_30px_rgba(59,130,246,0.05)] hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]', 
      icon: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
      price: 'text-blue-400',
      badge: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
      dot: 'bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.6)]'
    },
    { 
      // Purple - Blanqueamiento
      card: 'bg-[#0f172a] border-purple-500/30 hover:border-purple-500/60 shadow-[0_0_30px_rgba(168,85,247,0.05)] hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]', 
      icon: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
      price: 'text-purple-400',
      badge: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
      dot: 'bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.6)]'
    },
    { 
      // Emerald - Endodoncia
      card: 'bg-[#0f172a] border-emerald-500/30 hover:border-emerald-500/60 shadow-[0_0_30px_rgba(16,185,129,0.05)] hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]', 
      icon: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      price: 'text-emerald-400',
      badge: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
      dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
    },
    { 
      // Amber - Extraccion
      card: 'bg-[#0f172a] border-amber-500/30 hover:border-amber-500/60 shadow-[0_0_30px_rgba(245,158,11,0.05)] hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]', 
      icon: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
      price: 'text-amber-400',
      badge: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
      dot: 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
    },
    { 
      // Rose - Extra
      card: 'bg-[#0f172a] border-rose-500/30 hover:border-rose-500/60 shadow-[0_0_30px_rgba(244,63,94,0.05)] hover:shadow-[0_0_30px_rgba(244,63,94,0.15)]', 
      icon: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
      price: 'text-rose-400',
      badge: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
      dot: 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
    },
    { 
      // Cyan - Extra
      card: 'bg-[#0f172a] border-cyan-500/30 hover:border-cyan-500/60 shadow-[0_0_30px_rgba(6,182,212,0.05)] hover:shadow-[0_0_30px_rgba(6,182,212,0.15)]', 
      icon: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
      price: 'text-cyan-400',
      badge: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
      dot: 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)]'
    },
  ];
  return palettes[index % palettes.length];
};

const Services: React.FC<ServicesProps> = ({ 
  services, onAddService, onUpdateService, onDeleteService,
  inventoryNotes, onAddInventoryNote, onDeleteInventoryNote, onToggleInventoryComplete
}) => {
  const [filter, setFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingService, setEditingService] = useState<ClinicalService | null>(null);
  const [inventoryText, setInventoryText] = useState('');

  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const [authAction, setAuthAction] = useState<{ type: 'edit' | 'delete' | 'del_inv', data: any } | null>(null);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState(false);

  const filteredServices = services.filter(s => s.name.toLowerCase().includes(filter.toLowerCase()));
  const pendingInventory = inventoryNotes.filter(n => n.status !== 'completed');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPrice) return;
    onAddService({ id: Math.random().toString(36).substr(2, 9), name: newName, basePrice: parseFloat(newPrice) || 0, description: newDesc, icon: 'medical_services' });
    setShowAddModal(false);
    setNewName(''); setNewPrice(''); setNewDesc('');
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingService) {
      onUpdateService(editingService.id, { name: editName, basePrice: parseFloat(editPrice) || 0, description: editDesc });
      setEditingService(null);
    }
  };

  const handleAuthorize = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (authPassword === '12') {
      if (authAction) {
        if (authAction.type === 'edit') {
          setEditingService(authAction.data); 
          setEditName(authAction.data.name);
          setEditPrice(authAction.data.basePrice.toString());
          setEditDesc(authAction.data.description);
        } else if (authAction.type === 'delete') {
          onDeleteService(authAction.data.id);
        } else if (authAction.type === 'del_inv') {
          onDeleteInventoryNote(authAction.data.id);
        }
        setAuthAction(null);
        setAuthPassword('');
        setAuthError(false);
      }
    } else {
      setAuthError(true);
      setTimeout(() => setAuthError(false), 2000);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1900px] mx-auto space-y-6 animate-in fade-in duration-500 dark:bg-[#020617] min-h-full flex flex-col transition-all">
      
      {/* HEADER EXACTO SCREENSHOT */}
      <div className="bg-[#111827] p-5 sm:p-8 rounded-[28px] sm:rounded-[36px] border border-white/5 shadow-2xl relative overflow-hidden shrink-0 flex flex-col sm:flex-row gap-5 justify-between sm:items-center group">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-rose-500 via-primary to-emerald-500 opacity-60"></div>
        <div className="flex items-center gap-4 sm:gap-6 z-10">
           <div className="size-12 sm:size-14 rounded-2xl sm:rounded-[20px] bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20 shadow-inner group-hover:scale-105 transition-transform shrink-0">
              <span className="material-symbols-outlined text-[28px] sm:text-[32px]">assignment_turned_in</span>
           </div>
           <div>
              <h2 className="text-2xl sm:text-3xl md:text-[38px] font-black text-white uppercase tracking-tighter leading-none select-none">Servicios e Inventario</h2>
              <p className="text-[9px] sm:text-[11px] font-black text-slate-500 uppercase tracking-[0.25em] sm:tracking-[0.4em] mt-1.5 leading-none">GESTIÓN UNIFICADA SM DENTAL</p>
           </div>
        </div>
        <button 
          onClick={() => setShowAddModal(true)} 
          className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-10 bg-primary hover:bg-blue-600 text-white rounded-xl sm:rounded-[22px] font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-98 transition-all shadow-xl border-b-4 border-blue-700"
        >
          + NUEVO SERVICIO
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        
        {/* COLUMNA IZQUIERDA: INVENTARIO (Screenshot layout) */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 min-h-0">
           {/* TARJETA REGISTRAR FALTANTE */}
           <div className="bg-[#111827] p-5 sm:p-8 rounded-[28px] sm:rounded-[36px] lg:rounded-[42px] border border-white/5 shadow-2xl flex flex-col gap-5 sm:gap-6 shrink-0 relative overflow-hidden group">
              <div className="flex items-center gap-3.5">
                <span className="material-symbols-outlined text-amber-500 text-2xl animate-pulse">warning</span>
                <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-[0.2em] leading-none">REGISTRAR FALTANTE</h3>
              </div>
              <div className="relative">
                <textarea 
                  className="w-full h-32 sm:h-40 bg-[#020617] border-2 border-slate-800 rounded-[20px] sm:rounded-[32px] p-5 sm:p-6 text-sm font-bold text-slate-200 focus:outline-none focus:border-amber-500/50 resize-none shadow-inner transition-all placeholder:text-slate-600 leading-relaxed"
                  placeholder="Escriba aquí los materiales que faltan..."
                  value={inventoryText}
                  onChange={e => setInventoryText(e.target.value)}
                />
              </div>
              <button 
                onClick={() => { if(inventoryText.trim()){ onAddInventoryNote(inventoryText); setInventoryText(''); } }}
                className="h-12 sm:h-14 w-full bg-[#f97316] text-white rounded-xl sm:rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all active:scale-98 border-b-4 border-orange-800 flex items-center justify-center gap-3"
              >
                ANOTAR PEDIDO
              </button>
           </div>

           {/* LISTA REQUERIMIENTOS */}
           <div className="flex-1 bg-[#0f172a] rounded-[28px] sm:rounded-[36px] lg:rounded-[42px] p-5 sm:p-8 border border-white/5 overflow-hidden flex flex-col relative min-h-[300px]">
              <div className="mb-4 sm:mb-6 shrink-0 flex items-center justify-between border-b border-white/5 pb-4">
                <h3 className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] leading-none">REQUERIMIENTOS: <span className="text-white ml-1.5 text-xs sm:text-sm">{pendingInventory.length}</span></h3>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-hide space-y-4 pr-1">
                {pendingInventory.map(note => (
                  <div key={note.id} className="bg-[#1e293b]/50 p-4 sm:p-6 rounded-[20px] sm:rounded-[32px] border border-white/5 shadow-lg group hover:border-amber-500/30 transition-all">
                     <div className="flex justify-between items-start mb-3 sm:mb-4 gap-2">
                        <div className="flex flex-col"><span className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">{note.date}</span><span className="text-[10px] sm:text-[12px] font-black text-amber-500 leading-none">{note.time}</span></div>
                        <div className="flex gap-1.5 shrink-0">
                           <button onClick={() => onToggleInventoryComplete(note.id)} className="size-8 sm:size-9 bg-emerald-500/10 text-emerald-500 rounded-lg sm:rounded-xl hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center border border-emerald-500/20"><span className="material-symbols-outlined text-base sm:text-lg">check</span></button>
                           <button onClick={() => setAuthAction({type: 'del_inv', data: note})} className="size-8 sm:size-9 bg-rose-500/10 text-rose-500 rounded-lg sm:rounded-xl opacity-100 lg:opacity-0 group-hover:opacity-100 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center border border-rose-500/20"><span className="material-symbols-outlined text-base sm:text-lg">delete</span></button>
                        </div>
                     </div>
                     <p className="text-xs sm:text-sm font-medium text-slate-300 leading-relaxed tracking-wide">
                       {note.text}
                     </p>
                     <div className="mt-3 sm:mt-4 flex items-center gap-1.5 opacity-55">
                        <span className="material-symbols-outlined text-xs sm:text-sm text-slate-400">person</span>
                        <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest">{note.author}</span>
                     </div>
                  </div>
                ))}
                {pendingInventory.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-20 space-y-4 py-16 sm:py-20 grayscale">
                    <span className="material-symbols-outlined text-[48px] sm:text-[60px] text-slate-500">inventory</span>
                    <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Sin pendientes</p>
                  </div>
                )}
              </div>
              
              {/* Decorative element at bottom */}
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-slate-800 rounded-full"></div>
           </div>
        </div>

        {/* COLUMNA DERECHA: SERVICIOS (Screenshot layout) */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6 min-h-0">
           <div className="relative shrink-0 group">
              <span className="material-symbols-outlined absolute left-5 sm:left-8 top-1/2 -translate-y-1/2 text-slate-500 transition-all text-xl sm:text-2xl group-focus-within:text-primary">search</span>
              <input 
                type="text" 
                placeholder="Buscar tratamiento en el catálogo..."
                className="w-full h-14 sm:h-20 bg-[#111827] border border-white/5 rounded-2xl sm:rounded-[36px] pl-14 sm:pl-20 pr-6 text-sm sm:text-[17px] font-black text-white shadow-xl focus:outline-none focus:ring-4 ring-primary/10 transition-all placeholder:text-slate-600"
                value={filter}
                onChange={e=>setFilter(e.target.value)}
              />
           </div>

           <div className="flex-1 overflow-y-auto scrollbar-hide pr-1">
              <div className="flex flex-col gap-3.5 pb-20">
                 {filteredServices.map((s, idx) => {
                   const palette = getServicePalette(idx);
                   return (
                     <div key={s.id} className={`p-4 sm:p-5 lg:p-6 rounded-2xl sm:rounded-3xl border-2 transition-all flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 group shadow-lg relative overflow-hidden ${palette.card}`}>
                        {/* LEFT COLUMN: Service Info */}
                        <div className="flex-1 min-w-0 z-10 flex items-start">
                           <div className="flex flex-col justify-center min-w-0">
                              <div className="flex items-center gap-2.5">
                                 <span className={`size-2.5 rounded-full ${palette.dot || 'bg-blue-400'} animate-pulse shrink-0`}></span>
                                 <h4 className="text-base sm:text-lg font-black text-white uppercase tracking-tight leading-none select-text">
                                   {s.name}
                                 </h4>
                              </div>
                              <p className="text-[11px] sm:text-xs font-semibold text-slate-400 mt-2 leading-relaxed tracking-tight select-text">
                                {s.description || 'Tratamiento estandarizado.'}
                              </p>
                           </div>
                        </div>

                        {/* RIGHT & ACTIONS: Price, Badge & Buttons */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-4 sm:gap-6 z-10 shrink-0 border-t border-white/5 sm:border-transparent pt-3 sm:pt-0">
                           <div className="flex items-center gap-4 shrink-0 select-none">
                              <div className="text-left sm:text-right">
                                 <p className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">PRECIO BASE</p>
                                 <p className={`text-base sm:text-[22px] font-black leading-none tracking-tight ${palette.price}`}>S/ {s.basePrice.toLocaleString()}</p>
                              </div>
                              <div className={`px-2.5 py-1 border rounded-full shrink-0 ${palette.badge}`}>
                                 <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest leading-none">ACTIVO</span>
                              </div>
                           </div>

                           <div className="flex gap-1.5 shrink-0">
                              <button onClick={() => setAuthAction({type: 'edit', data: s})} className="size-8 sm:size-9 bg-white/5 hover:bg-slate-800 rounded-lg sm:rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-all border border-white/5 shadow-xs" title="Editar"><span className="material-symbols-outlined text-sm sm:text-base">edit</span></button>
                              <button onClick={() => setAuthAction({type: 'delete', data: s})} className="size-8 sm:size-9 bg-rose-500/10 hover:bg-rose-500 rounded-lg sm:rounded-xl flex items-center justify-center text-rose-500 hover:text-white transition-all border border-rose-500/20 shadow-xs" title="Eliminar"><span className="material-symbols-outlined text-sm sm:text-base">delete</span></button>
                           </div>
                        </div>
                        
                        {/* Decorative background glow */}
                        <div className="absolute -right-16 -top-16 size-32 rounded-full bg-white/2 blur-[40px] pointer-events-none"></div>
                     </div>
                   );
                 })}
              </div>
           </div>
        </div>
      </div>

      {/* MODAL DE SEGURIDAD (CLAVE: 12) */}
      {authAction && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-[#111827] w-full max-w-sm rounded-[56px] shadow-[0_0_100px_rgba(0,0,0,0.6)] p-12 flex flex-col items-center border-4 border-white/5">
             <div className="size-20 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center mb-6 shadow-inner border border-rose-500/20">
               <span className="material-symbols-outlined text-4xl">lock_person</span>
             </div>
             <h3 className="text-xl font-black text-white uppercase mb-2 tracking-tighter">Acceso Seguro</h3>
             <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-10">Confirme credencial clínica</p>
             <input type="password" autoFocus className={`w-full h-20 bg-slate-900 border-none rounded-[32px] text-center text-5xl font-black tracking-[0.5em] text-white mb-8 shadow-inner transition-all ${authError ? 'ring-2 ring-rose-600 animate-shake bg-rose-500/5' : 'focus:ring-2 ring-primary/40'}`} value={authPassword} onChange={e=>setAuthPassword(e.target.value)} onKeyDown={e=>e.key==='Enter' && handleAuthorize()} placeholder="••" />
             <div className="flex gap-4 w-full">
                <button onClick={() => {setAuthAction(null); setAuthPassword('');}} className="flex-1 h-16 bg-slate-800 text-slate-400 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-700 transition-all">No</button>
                <button onClick={handleAuthorize} className="flex-1 h-16 bg-rose-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-2xl shadow-rose-600/20 active:scale-95 border-b-4 border-rose-800 transition-all">Confirmar</button>
             </div>
          </div>
        </div>
      )}

      {/* MODALES CREAR/EDITAR */}
      {(showAddModal || editingService) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#111827] w-full max-w-md rounded-[56px] shadow-2xl overflow-hidden border-8 border-white/5 p-12 relative">
             <div className="flex items-center gap-5 mb-12">
                <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                   <span className="material-symbols-outlined text-3xl">{editingService ? 'edit_square' : 'add_circle'}</span>
                </div>
                <div>
                   <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">{editingService ? 'Editar Servicio' : 'Nuevo Servicio'}</h3>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1.5">SM INTELLIGENCE CATALOG</p>
                </div>
             </div>
             <form onSubmit={editingService ? handleUpdate : handleCreate} className="space-y-7">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nombre Comercial</label>
                   <input required type="text" className="w-full h-18 bg-slate-900 border-none rounded-[28px] px-8 text-[15px] font-black text-white focus:ring-2 focus:ring-primary/40 shadow-inner" placeholder="Ej: Profilaxis..." value={editingService ? editName : newName} onChange={e => editingService ? setEditName(e.target.value) : setNewName(e.target.value)} />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Inversión Sugerida (S/)</label>
                   <input required type="number" step="0.01" className="w-full h-18 bg-slate-900 border-none rounded-[28px] px-8 text-[15px] font-black text-white focus:ring-2 focus:ring-primary/40 shadow-inner" placeholder="0.00" value={editingService ? editPrice : newPrice} onChange={e => editingService ? setEditPrice(e.target.value) : setNewPrice(e.target.value)} />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Detalle del Procedimiento</label>
                   <textarea className="w-full h-32 bg-slate-900 border-none rounded-[28px] p-8 text-[14px] font-bold text-white focus:ring-2 focus:ring-primary/40 shadow-inner resize-none placeholder:text-slate-800" placeholder="Escriba aquí los detalles..." value={editingService ? editDesc : newDesc} onChange={e => editingService ? setEditDesc(e.target.value) : setNewDesc(e.target.value)} />
                </div>
                <div className="flex gap-4 pt-6">
                   <button type="button" onClick={() => { setShowAddModal(false); setEditingService(null); }} className="flex-1 h-18 bg-slate-800 text-slate-400 font-black rounded-[28px] uppercase text-[11px] tracking-widest hover:bg-slate-700 transition-all">Cancelar</button>
                   <button type="submit" className="flex-1 h-18 bg-primary text-white font-black rounded-[28px] uppercase text-[11px] tracking-widest shadow-2xl shadow-primary/20 active:scale-95 border-b-4 border-blue-700 transition-all">
                     {editingService ? 'Actualizar' : 'REGISTRAR'}
                   </button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Services;
