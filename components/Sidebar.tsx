
import React from 'react';
import { ViewMode, Patient } from '../types';

interface SidebarProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onNewPatient: () => void;
  shortcuts?: Patient[];
  onSelectPatient?: (id: string, initialTab?: 'summary' | 'caja') => void;
  onHide?: () => void;
  onDownloadAllNewZips: () => void; // Nueva prop para la descarga masiva
  patientsNeedingBackupCount: number; // Nueva prop para el conteo
  isBulkDownloading: boolean; // Nueva prop para el estado de descarga
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, onViewChange, onNewPatient, shortcuts = [], onSelectPatient, onHide,
  onDownloadAllNewZips, patientsNeedingBackupCount, isBulkDownloading
}) => {
  const navItems = [
    { mode: ViewMode.DASHBOARD, icon: 'dashboard', label: 'Panel Principal', color: 'text-blue-500' },
    { mode: ViewMode.PATIENTS_LIST, icon: 'groups', label: 'Lista de Pacientes', color: 'text-cyan-500' },
    { mode: ViewMode.PATIENTS, icon: 'person', label: 'Ficha Clínica', color: 'text-emerald-500' },
    { mode: ViewMode.ODONTOGRAM, icon: 'dentistry', label: 'Odontograma', color: 'text-primary' },
    { mode: ViewMode.APPOINTMENTS, icon: 'calendar_month', label: 'Agenda / Citas', color: 'text-purple-500' },
    { mode: ViewMode.FINANCES, icon: 'monetization_on', label: 'Finanzas / Caja', color: 'text-emerald-600' },
    { mode: ViewMode.SERVICES, icon: 'medical_services', label: 'Servicios / Inventario', color: 'text-rose-500' },
  ];

  return (
    <aside className="w-64 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between p-4 shrink-0 shadow-2xl z-50 transition-colors duration-300 relative">
      {/* BOTÓN OCULTAR / CERRAR (Visible en móviles y cuando está abierto) */}
      <button 
        onClick={onHide}
        className="absolute top-4 right-2 size-8 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-primary rounded-full flex items-center justify-center transition-all z-40 border border-slate-100 dark:border-slate-700 lg:hidden"
        title="Ocultar menú"
      >
        <span className="material-symbols-outlined text-lg">close</span>
      </button>

      {/* Botón de minimizar para desktop */}
      <button 
        onClick={onHide}
        className="absolute -right-4 top-1/2 -translate-y-1/2 size-8 bg-white dark:bg-slate-900 text-slate-400 hover:text-primary rounded-full flex lg:hidden items-center justify-center transition-all z-40 border border-slate-200 dark:border-slate-800 shadow-lg"
        title="Ocultar menú"
      >
        <span className="material-symbols-outlined text-lg">chevron_left</span>
      </button>

      <div className="flex flex-col gap-6 overflow-y-auto scrollbar-hide">
          <div className="flex flex-col px-2 py-4">
            <div className="flex items-center gap-2">
              <div className="text-[#1a5eb0] dark:text-[#3b82f6]">
                <span className="material-symbols-outlined text-[40px] font-light" style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}>dentistry</span>
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-[#1a5eb0] dark:text-[#3b82f6] text-[13px] font-black tracking-tight uppercase">Clínica Dental</span>
                <span className="text-[#1a5eb0] dark:text-[#3b82f6] text-[15px] font-black tracking-tighter uppercase">San Miguel</span>
              </div>
            </div>
            <div className="relative mt-1">
              <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#4fd1c5] to-transparent rounded-full shadow-[0_0_8px_rgba(79,209,197,0.5)]"></div>
              <div className="text-right mt-1">
                <p className="text-[#f9b115] text-[7px] font-black uppercase tracking-[0.15em]">Odontología Integral</p>
              </div>
            </div>
          </div>

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <button
              key={item.mode}
              onClick={() => onViewChange(item.mode)}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 ${
                currentView === item.mode 
                  ? 'bg-primary/10 dark:bg-primary/20 text-primary font-black shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span className={`material-symbols-outlined ${currentView === item.mode ? 'text-primary' : item.color}`}>{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* ACCESOS DIRECTOS SECTION */}
        {shortcuts.length > 0 && (
          <div className="mt-4 px-2 space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Pacientes del Día</h4>
            <div className="space-y-2">
              {shortcuts.map(p => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all border border-slate-100 dark:border-slate-800"
                >
                  <button
                    onClick={() => onSelectPatient && onSelectPatient(p.id, 'summary')}
                    className="flex items-center gap-2 text-left flex-1 min-w-0"
                    title={p.name}
                  >
                    <img 
                      src={p.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=random&color=fff`} 
                      className="size-8 rounded-full border border-slate-200 dark:border-slate-700 object-cover shrink-0" 
                      alt={p.name}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black text-slate-800 dark:text-slate-200 truncate uppercase tracking-tight leading-tight">
                        {p.name}
                      </p>
                      <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                        Cita Hoy
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => onSelectPatient && onSelectPatient(p.id, 'caja')}
                    className="ml-2 size-7 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-lg shadow-sm transition-all flex items-center justify-center shrink-0"
                    title={`Cobrar a ${p.name}`}
                  >
                    <span className="material-symbols-outlined text-sm">payments</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
