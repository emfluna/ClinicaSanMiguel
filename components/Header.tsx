
import React, { useState, useRef, useEffect } from 'react';
import { Patient, User, AppNotification } from '../types';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: Patient[];
  onSelectPatient: (id: string) => void;
  onLogout: () => void;
  onOpenSettings: () => void;
  user: User;
  notifications?: AppNotification[];
  onMarkRead?: (id: string) => void;
  onClearAll?: () => void;
  isSidebarVisible?: boolean;
  onToggleSidebar?: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
  searchQuery, 
  setSearchQuery, 
  searchResults, 
  onSelectPatient, 
  onLogout, 
  onOpenSettings, 
  user,
  notifications = [],
  onMarkRead,
  onClearAll,
  isSidebarVisible,
  onToggleSidebar
}) => {
  const [showResults, setShowResults] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getNotifIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'appointment': return 'calendar_month';
      case 'patient': return 'person_add';
      case 'finance': return 'payments';
      case 'inventory': return 'inventory_2';
      default: return 'notifications';
    }
  };

  const getNotifColor = (type: AppNotification['type']) => {
    switch (type) {
      case 'appointment': return 'text-purple-500';
      case 'patient': return 'text-emerald-500';
      case 'finance': return 'text-blue-500';
      case 'inventory': return 'text-amber-500';
      default: return 'text-primary';
    }
  };

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-8 py-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-300">
      <div className="flex items-center gap-4 flex-1">
        {/* BOTÓN RESTAURAR SIDEBAR */}
        {!isSidebarVisible && (
          <button 
            onClick={onToggleSidebar}
            className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-all flex items-center justify-center shrink-0 border border-primary/20 animate-in slide-in-from-left-2"
            title="Mostrar menú"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        )}

        <div className="flex-1 max-w-xl relative" ref={searchRef}>
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl px-4 h-10 border border-transparent focus-within:border-primary focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <span className="material-symbols-outlined text-primary mr-2">search</span>
            <input
              type="text"
              placeholder="Buscar pacientes por nombre o ID..."
              className="bg-transparent border-none focus:ring-0 text-sm w-full p-0 font-medium dark:text-white"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-red-500 transition-colors">
                <span className="material-symbols-outlined text-lg">cancel</span>
              </button>
            )}
          </div>

          {showResults && searchQuery && (
            <div className="absolute top-12 left-0 right-0 bg-white dark:bg-slate-900 shadow-2xl rounded-2xl border border-slate-100 dark:border-slate-800 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
              <div className="p-2 border-b border-slate-50 dark:border-slate-800">
                <p className="text-[10px] font-black text-slate-400 px-3 py-1 uppercase tracking-widest">Resultados de Búsqueda</p>
              </div>
              {searchResults.length > 0 ? (
                searchResults.slice(0, 5).map(patient => (
                  <div 
                    key={patient.id}
                    onClick={() => { onSelectPatient(patient.id); setShowResults(false); }}
                    className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <img src={patient.photo} className="size-10 rounded-xl object-cover border border-slate-100 dark:border-slate-700 shadow-sm" alt={patient.name} />
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">{patient.name}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">ID: {patient.id} • Última visita: {patient.lastVisit || 'N/A'}</p>
                    </div>
                    <span className="ml-auto material-symbols-outlined text-primary">chevron_right</span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-slate-500 italic">No se encontraron pacientes.</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-6">
        <div className="flex gap-2 relative" ref={notifRef}>
          <button 
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className={`p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 relative hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${showNotifMenu ? 'bg-slate-200 dark:bg-slate-700' : ''}`}
          >
            <span className={`material-symbols-outlined text-amber-500 ${unreadCount > 0 ? 'animate-bell-ring' : ''}`}>notifications</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 size-5 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900 animate-in zoom-in">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute top-12 right-0 w-80 bg-white dark:bg-slate-900 shadow-2xl rounded-[32px] border border-slate-100 dark:border-slate-800 z-50 overflow-hidden animate-in fade-in slide-in-from-top-4">
              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notificaciones</p>
                {notifications.length > 0 && (
                  <button onClick={onClearAll} className="text-[9px] font-black text-primary hover:underline uppercase tracking-widest">Limpiar todo</button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800">
                {notifications.length > 0 ? (
                  notifications.map(notif => (
                    <div 
                      key={notif.id} 
                      onClick={() => onMarkRead && onMarkRead(notif.id)}
                      className={`p-4 flex gap-4 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors relative ${!notif.read ? 'bg-primary/5' : ''}`}
                    >
                      {!notif.read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>}
                      <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm`}>
                        <span className={`material-symbols-outlined ${getNotifColor(notif.type)}`}>{getNotifIcon(notif.type)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className="text-sm font-black text-slate-900 dark:text-white truncate">{notif.title}</p>
                          <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap">{notif.timestamp}</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight mt-0.5 line-clamp-2">{notif.message}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-10 text-center space-y-3">
                    <span className="material-symbols-outlined text-[48px] text-slate-200 dark:text-slate-700">notifications_off</span>
                    <p className="text-xs font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">No hay alertas nuevas</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="h-8 w-px bg-slate-200 dark:bg-slate-800"></div>
        
        <div className="relative" ref={profileRef}>
          <button 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-3 p-1 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="text-right hidden sm:block px-2">
              <p className="text-sm font-black text-slate-900 dark:text-white leading-none">{user.name}</p>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Autorizado</p>
            </div>
            <div className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
              {user.photo ? (
                <img src={user.photo} className="size-full object-cover" alt={user.name} />
              ) : (
                <span className="material-symbols-outlined text-primary">person</span>
              )}
            </div>
          </button>

          {showProfileMenu && (
            <div className="absolute top-14 right-0 w-48 bg-white dark:bg-slate-900 shadow-2xl rounded-2xl border border-slate-100 dark:border-slate-800 p-2 animate-in fade-in slide-in-from-top-2">
              <div className="p-3 border-b border-slate-50 dark:border-slate-800 mb-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mi Cuenta</p>
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate mt-1">{user.email}</p>
              </div>
              <button 
                onClick={() => { onOpenSettings(); setShowProfileMenu(false); }}
                className="w-full flex items-center gap-3 p-2.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                <span className="material-symbols-outlined text-lg">settings</span>
                Configuración
              </button>
              <button 
                onClick={onLogout}
                className="w-full flex items-center gap-3 p-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-colors"
              >
                <span className="material-symbols-outlined text-lg">logout</span>
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
