
import React, { useState, useRef } from 'react';
import { User, NotificationSoundProfile } from '../types';

interface SettingsProps {
  user: User;
  onUpdateUser: (updates: Partial<User>) => void;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  soundProfile: NotificationSoundProfile;
  onSoundProfileChange: (profile: NotificationSoundProfile) => void;
}

const Settings: React.FC<SettingsProps> = ({ 
  user, onUpdateUser, theme, onThemeChange, soundProfile, onSoundProfileChange
}) => {
  const [name, setName] = useState(user.name);
  const [isUploading, setIsUploading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdateUser({ photo: reader.result as string });
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser({ name });
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-12 max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      {/* HEADER CONFIGURACIÓN */}
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl sm:text-[42px] lg:text-[52px] font-black tracking-tighter text-slate-900 dark:text-white leading-none">Configuración</h2>
        <p className="text-slate-400 font-bold uppercase tracking-[0.25em] text-[10px] lg:text-[12px]">GESTIÓN DE PERFIL DE USUARIO AUTORIZADO</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-14">
        
        {/* PANEL IZQUIERDO: FORMULARIO PERFIL */}
        <div className="lg:col-span-8">
          <div className="bg-white dark:bg-slate-900/50 rounded-[32px] sm:rounded-[48px] lg:rounded-[64px] border border-slate-100 dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-none overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-3 bg-primary"></div>
            
            <form onSubmit={handleSubmit} className="p-5 sm:p-10 lg:p-16 space-y-8 lg:space-y-12">
              
              {/* HEADER DE IDENTIDAD (Screenshot replica) */}
              <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6 lg:gap-10 bg-slate-50/50 dark:bg-slate-800/30 p-5 sm:p-8 lg:p-12 rounded-[24px] sm:rounded-[40px] lg:rounded-[48px] border border-slate-100 dark:border-slate-800 group relative">
                <div className="relative shrink-0">
                  <div className={`size-20 sm:size-24 lg:size-32 rounded-[28px] lg:rounded-[40px] overflow-hidden border-4 border-white dark:border-slate-700 shadow-xl transition-all group-hover:scale-105 ${isUploading ? 'opacity-50 animate-pulse' : ''}`}>
                    <img 
                      src={user.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} 
                      className="size-full object-cover" 
                      alt="Perfil" 
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="absolute -bottom-2 -right-2 size-10 sm:size-12 lg:size-14 bg-primary text-white rounded-xl sm:rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/40 hover:bg-blue-700 hover:scale-110 active:scale-90 transition-all border-4 border-white dark:border-slate-800"
                  >
                    <span className="material-symbols-outlined text-base sm:text-xl lg:text-2xl">
                      {isUploading ? 'sync' : 'photo_camera'}
                    </span>
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handlePhotoUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>
                
                <div className="min-w-0 flex-1 text-center sm:text-left select-none">
                  <p className="text-lg sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white truncate leading-none tracking-tight">{user.email}</p>
                  <p className="text-[9px] sm:text-[10px] lg:text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2.5">IDENTIFICADOR DE USUARIO</p>
                </div>

                {showSuccess && (
                  <div className="absolute top-3 right-6 text-emerald-500 flex items-center gap-1.5 animate-in slide-in-from-right-2">
                    <span className="material-symbols-outlined text-sm sm:text-base">check_circle</span>
                    <span className="text-[9px] font-black uppercase">Actualizado</span>
                  </div>
                )}
              </div>

              {/* CAMPO NICKNAME */}
              <div className="space-y-3">
                <label className="text-[10px] sm:text-[11px] lg:text-[12px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 sm:ml-2">NOMBRE DE USUARIO AUTORIZADO</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-5 sm:left-8 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-all text-xl sm:text-2xl">person</span>
                  <input 
                    type="text" 
                    required 
                    className="w-full h-12 sm:h-16 lg:h-20 bg-slate-50 dark:bg-slate-800/50 border-none rounded-[18px] sm:rounded-[28px] lg:rounded-[36px] pl-14 sm:pl-20 pr-6 text-sm sm:text-base lg:text-[18px] font-black text-slate-800 dark:text-white focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all shadow-inner placeholder:text-slate-300"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="emf.luna"
                  />
                </div>
              </div>

              {/* BOTÓN GUARDAR */}
              <div className="flex justify-center lg:justify-end pt-2">
                <button 
                  type="submit" 
                  className="w-full lg:w-auto px-8 sm:px-14 h-12 sm:h-16 lg:h-20 bg-primary hover:bg-blue-600 text-white font-black rounded-[18px] sm:rounded-[28px] lg:rounded-[36px] shadow-2xl shadow-primary/40 hover:scale-[1.01] active:scale-98 transition-all uppercase tracking-[0.2em] text-[11px] lg:text-[13px] flex items-center justify-center gap-3"
                >
                  <span className="material-symbols-outlined text-lg sm:text-2xl">save</span>
                  GUARDAR CAMBIOS
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* PANEL DERECHO: PERSONALIZACIÓN Y SONIDOS */}
        <div className="lg:col-span-4 flex flex-col gap-6 sm:gap-8 lg:gap-12">
          
          {/* PERSONALIZACIÓN TEMA */}
          <div className="bg-white dark:bg-slate-900/50 rounded-[32px] sm:rounded-[48px] lg:rounded-[56px] p-5 sm:p-8 lg:p-10 border border-slate-100 dark:border-slate-800 shadow-sm">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-6 sm:mb-8 leading-none uppercase">Interfaz</h3>
            
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-4 sm:gap-6">
              <button 
                onClick={() => onThemeChange('light')}
                className={`p-4 sm:p-5 lg:p-6 rounded-[24px] sm:rounded-[36px] border-2 lg:border-4 transition-all flex items-center gap-3 sm:gap-4 group relative ${
                  theme === 'light' 
                  ? 'bg-primary/5 border-primary shadow-xl' 
                  : 'bg-slate-50 dark:bg-slate-800/50 border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <div className={`size-10 sm:size-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all shrink-0 ${theme === 'light' ? 'bg-primary text-white animate-spin' : 'bg-white dark:bg-slate-700 text-amber-500 shadow-sm'}`} style={{ animationDuration: '3s' }}>
                  <span className="material-symbols-outlined text-lg sm:text-xl font-black">light_mode</span>
                </div>
                <div className="text-left select-none">
                  <p className={`text-[12px] sm:text-[13px] font-black tracking-tight ${theme === 'light' ? 'text-primary' : 'text-slate-700 dark:text-slate-300'}`}>Claro</p>
                </div>
              </button>

              <button 
                onClick={() => onThemeChange('dark')}
                className={`p-4 sm:p-5 lg:p-6 rounded-[24px] sm:rounded-[36px] border-2 lg:border-4 transition-all flex items-center gap-3 sm:gap-4 group relative ${
                  theme === 'dark' 
                  ? 'bg-slate-900 border-primary shadow-xl shadow-indigo-950/20' 
                  : 'bg-slate-50 dark:bg-slate-800/50 border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <div className={`size-10 sm:size-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all shrink-0 ${theme === 'dark' ? 'bg-primary text-white' : 'bg-white dark:bg-slate-700 text-slate-500 shadow-sm'}`}>
                  <span className="material-symbols-outlined text-lg sm:text-xl font-black">dark_mode</span>
                </div>
                <div className="text-left select-none">
                  <p className={`text-[12px] sm:text-[13px] font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>Oscuro</p>
                </div>
              </button>
            </div>
          </div>

          {/* PREFERENCIAS DE SONIDO (NUEVA SECCIÓN) */}
          <div className="bg-white dark:bg-slate-900/50 rounded-[32px] sm:rounded-[48px] lg:rounded-[56px] p-5 sm:p-8 lg:p-10 border border-slate-100 dark:border-slate-800 shadow-sm">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-1">Notificaciones de Aplicación</h3>
            <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 sm:mb-8">Temas sonoros en la página</p>
            
            <div className="space-y-3 sm:space-y-4">
              {[
                { id: 'nature', label: 'Naturaleza', icon: 'eco', desc: 'Agua y Campanas de viento' },
                { id: 'zen', label: 'Modo Zen', icon: 'self_improvement', desc: 'Cuencos Tibetanos' },
                { id: 'digital', label: 'Profesional', icon: 'settings_input_component', desc: 'Tonos Digitales Claros' }
              ].map((p) => (
                <button 
                  key={p.id}
                  onClick={() => onSoundProfileChange(p.id as NotificationSoundProfile)}
                  className={`w-full p-4 sm:p-5 rounded-[20px] sm:rounded-[28px] lg:rounded-[32px] border-2 lg:border-4 transition-all flex items-center gap-3 sm:gap-4 group relative ${
                    soundProfile === p.id 
                    ? 'bg-emerald-500/5 border-emerald-500 shadow-lg' 
                    : 'bg-slate-50 dark:bg-slate-800/50 border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <div className={`size-10 sm:size-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all shrink-0 ${soundProfile === p.id ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-slate-700 text-slate-400 shadow-sm'}`}>
                    <span className="material-symbols-outlined text-lg sm:text-xl font-black">{p.icon}</span>
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className={`text-[12px] sm:text-[13px] font-black tracking-tight leading-none ${soundProfile === p.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>{p.label}</p>
                    <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 sm:mt-1.5 truncate leading-none">{p.desc}</p>
                  </div>
                  {soundProfile === p.id && (
                    <span className="material-symbols-outlined ml-auto text-emerald-500 animate-in zoom-in shrink-0 text-sm sm:text-base">volume_up</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* SEGURIDAD DE LA CUENTA */}
          <div className="bg-[#0f172a] dark:bg-black rounded-[32px] sm:rounded-[48px] p-6 sm:p-8 lg:p-10 text-white relative overflow-hidden group shadow-2xl">
            <span className="material-symbols-outlined absolute -right-8 -bottom-8 text-[120px] sm:text-[180px] text-white/5 pointer-events-none group-hover:scale-110 transition-transform">verified_user</span>
            <div className="relative z-10 space-y-4 sm:space-y-6">
              <h4 className="text-xl sm:text-2xl font-black tracking-tight leading-none uppercase">Seguridad</h4>
              <p className="text-[10px] sm:text-[12px] text-slate-400 font-bold leading-relaxed opacity-80 max-w-[240px]">
                Gestione su acceso de forma responsable.
              </p>
              <div className="h-1 w-16 bg-primary/40 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
