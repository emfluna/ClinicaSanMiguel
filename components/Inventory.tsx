
import React, { useState } from 'react';
import { InventoryNote } from '../types';

interface InventoryProps {
  notes: InventoryNote[];
  onAddNote: (text: string) => void;
  onDeleteNote: (id: string) => void;
  onToggleComplete?: (id: string) => void;
}

const Inventory: React.FC<InventoryProps> = ({ notes, onAddNote, onDeleteNote, onToggleComplete }) => {
  const [inputText, setInputText] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  
  // Estados para eliminación protegida
  const [showDeleteAuthModal, setShowDeleteAuthModal] = useState(false);
  const [targetDeleteId, setTargetDeleteId] = useState<string | null>(null);
  const [deleteAuthKey, setDeleteAuthKey] = useState('');
  const [deleteAuthError, setDeleteAuthError] = useState(false);

  const pendingNotes = notes.filter(n => n.status !== 'completed');
  const completedNotes = notes.filter(n => n.status === 'completed');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onAddNote(inputText);
    setInputText('');
  };

  const initiateDelete = (id: string) => {
    setTargetDeleteId(id);
    setDeleteAuthKey('');
    setDeleteAuthError(false);
    setShowDeleteAuthModal(true);
  };

  const handleAuthorizeDelete = () => {
    if (deleteAuthKey === '0donto12') {
      if (targetDeleteId) {
        onDeleteNote(targetDeleteId);
        setShowDeleteAuthModal(false);
        setTargetDeleteId(null);
      }
    } else {
      setDeleteAuthError(true);
      setTimeout(() => setDeleteAuthError(false), 2000);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-12 animate-in fade-in duration-500 pb-24">
      {/* HEADER SECTION */}
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h2 className="text-[42px] font-black tracking-tighter text-[#0f172a] leading-none">Inventario y Suministros</h2>
          <p className="text-[#64748b] font-black uppercase tracking-[0.15em] text-[11px] mt-2">GESTIÓN DE MATERIALES FALTANTES Y STOCK</p>
        </div>
        
        {/* PENDIENTES BADGE */}
        <div className="p-1 rounded-[24px] bg-gradient-to-b from-amber-400 to-amber-600 shadow-xl shadow-amber-200/50">
          <div className="px-5 py-3 bg-transparent text-white rounded-[20px] flex items-center gap-3 border border-white/10 border-dashed">
            <span className="material-symbols-outlined text-[24px]">inventory_2</span>
            <div className="flex flex-col leading-none">
              <span className="text-[8px] font-black uppercase tracking-widest opacity-80">PENDIENTES</span>
              <span className="text-lg font-black">{pendingNotes.length} Notas</span>
            </div>
          </div>
        </div>
      </div>

      {/* REGISTRATION FORM */}
      <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm relative group overflow-hidden transition-all hover:shadow-lg">
        <div className="absolute -top-6 -left-6 size-24 bg-amber-50 rounded-full opacity-50 group-hover:scale-110 transition-transform flex items-center justify-center pt-6 pl-6">
           <span className="material-symbols-outlined text-amber-500 text-3xl">edit_note</span>
        </div>

        <div className="relative">
          <h3 className="font-black text-xl text-slate-900 mb-8 flex items-center gap-3 ml-2">
            Registrar Material Faltante
          </h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="p-1 rounded-[32px] bg-slate-100/50 shadow-inner">
              <textarea 
                className="w-full min-h-[140px] bg-transparent border-none rounded-[32px] p-8 text-sm font-bold text-slate-700 focus:ring-0 placeholder:text-slate-300"
                placeholder="Ej: Se necesitan 3 cajas de guantes de látex talla M, resina 3M A2..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
            </div>
            
            <div className="flex justify-end pr-2">
              <div className="p-1 rounded-[22px] bg-gradient-to-b from-amber-400 to-amber-600 shadow-xl shadow-amber-200/40">
                <button 
                  type="submit"
                  className="px-8 h-14 bg-transparent text-white rounded-[18px] font-black text-[12px] uppercase tracking-[0.15em] hover:bg-white/10 transition-all flex items-center gap-3 border border-white/5 border-dashed"
                >
                  <span className="material-symbols-outlined text-lg">post_add</span> Anotar Pedido
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* LIST SECTION */}
      <div className="space-y-8">
        <div className="flex justify-between items-center px-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">LISTA DE REQUERIMIENTOS</h3>
          {completedNotes.length > 0 && (
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="text-[10px] font-black text-slate-400 hover:text-primary transition-colors uppercase tracking-[0.2em] flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">{showHistory ? 'visibility_off' : 'history'}</span>
              {showHistory ? 'OCULTAR HISTORIAL' : `VER HISTORIAL (${completedNotes.length})`}
            </button>
          )}
        </div>

        <div className="space-y-6">
          {(showHistory ? notes : pendingNotes).map(note => (
            <div key={note.id} className={`bg-white p-2 rounded-[40px] border border-slate-100 shadow-sm group hover:border-amber-500/20 transition-all flex items-stretch ${note.status === 'completed' ? 'opacity-60 grayscale-[0.5]' : ''}`}>
              <div className="p-8 flex-1 flex gap-10 items-center">
                <div className="bg-slate-50 border border-slate-100/50 p-6 rounded-[32px] flex flex-col items-center justify-center min-w-[140px] shrink-0 shadow-inner">
                  <p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.15em]">{note.date}</p>
                  <p className="text-xl font-black text-slate-900 mt-1 leading-none">{note.time}</p>
                </div>
                
                <div className="flex-1 space-y-3">
                  <p className={`text-slate-800 text-[15px] font-bold leading-relaxed ${note.status === 'completed' ? 'line-through' : ''}`}>
                    {note.text}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-slate-300">person</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Solicitado por {note.author}</span>
                  </div>
                </div>
              </div>

              {/* ACTIONS */}
              <div className="pr-8 flex items-center gap-3">
                {note.status === 'pending' && onToggleComplete && (
                  <button 
                    onClick={() => onToggleComplete(note.id)}
                    className="size-12 bg-emerald-50 text-emerald-500 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center border border-emerald-100/50 shadow-sm"
                    title="Marcar como Completado"
                  >
                    <span className="material-symbols-outlined text-2xl">check_circle</span>
                  </button>
                )}
                <button 
                  onClick={() => initiateDelete(note.id)}
                  className="size-12 bg-red-50 text-red-400 rounded-2xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center border border-red-100/50 shadow-sm opacity-0 group-hover:opacity-100"
                  title="Eliminar Registro (Protegido)"
                >
                  <span className="material-symbols-outlined text-2xl">delete</span>
                </button>
              </div>
            </div>
          ))}

          {(showHistory ? notes : pendingNotes).length === 0 && (
            <div className="bg-slate-50/50 rounded-[48px] border-4 border-dashed border-white py-24 text-center">
              <span className="material-symbols-outlined text-[80px] text-slate-200 opacity-20">inventory</span>
              <p className="text-slate-400 font-black uppercase tracking-[0.2em] mt-6 italic">
                {showHistory ? 'HISTORIAL VACÍO' : 'NO HAY PEDIDOS PENDIENTES'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE AUTORIZACIÓN PARA ELIMINAR REGISTROS DE INVENTARIO */}
      {showDeleteAuthModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl overflow-hidden border-8 border-white animate-in zoom-in duration-200">
            <div className="p-8 border-b border-slate-100 bg-slate-50 flex flex-col items-center text-center">
              <div className="size-16 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-4 shadow-sm">
                <span className="material-symbols-outlined text-3xl">lock_person</span>
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Acción Protegida</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                INGRESE LA CLAVE PARA ANULAR ESTE REGISTRO
              </p>
            </div>
            <div className="p-8 space-y-5">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">key</span>
                <input 
                  type="password" 
                  autoFocus
                  className={`w-full h-14 bg-slate-50 border-none rounded-2xl pl-12 pr-4 text-center font-black tracking-[0.4em] focus:ring-2 transition-all ${
                    deleteAuthError ? 'ring-2 ring-red-500 bg-red-50' : 'focus:ring-primary/20'
                  }`}
                  placeholder="••••••••"
                  value={deleteAuthKey}
                  onChange={e => setDeleteAuthKey(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAuthorizeDelete()}
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => { setShowDeleteAuthModal(false); setTargetDeleteId(null); }} 
                  className="flex-1 h-14 border-2 border-slate-100 text-slate-500 font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all"
                >
                  CANCELAR
                </button>
                <button 
                  onClick={handleAuthorizeDelete} 
                  className="flex-1 h-14 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-500/20 hover:bg-red-700 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest text-[10px]"
                >
                  CONFIRMAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;