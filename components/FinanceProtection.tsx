
import React, { useState } from 'react';

interface FinanceProtectionProps {
  onUnlock: () => void;
}

const FinanceProtection: React.FC<FinanceProtectionProps> = ({ onUnlock }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Clave actualizada a gonzalito05 según requerimiento
    if (password === 'gonzalito05') {
      onUnlock();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="h-full flex items-center justify-center p-6 relative overflow-hidden">
      {/* FONDO DE CLÍNICA MODERNA CON OVERLAY */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1629909608135-ca40a0006c66?q=80&w=2072&auto=format&fit=crop" 
          className="w-full h-full object-cover scale-105"
          alt="Modern Dental Clinic"
        />
        <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-[4px] transition-colors duration-500"></div>
      </div>

      <div className="w-full max-w-sm z-10 animate-in fade-in zoom-in duration-700">
        <div className="bg-white/10 dark:bg-white/5 p-1 rounded-[54px] backdrop-blur-md border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
          <div className="bg-[#f8fafc] dark:bg-slate-900 p-10 rounded-[48px] shadow-inner text-center relative overflow-hidden border border-white/40 dark:border-slate-800">
            {/* Decorative Top Bar */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-primary shadow-[0_0_15px_rgba(56,88,250,0.5)]"></div>
            
            <div className="bg-white dark:bg-slate-800/50 p-10 rounded-[40px] shadow-sm border border-slate-100 dark:border-slate-700/50 flex flex-col items-center">
              {/* Icono de Seguridad Animado */}
              <div className="mb-8 relative">
                <span className="material-symbols-outlined text-[82px] text-primary/20 absolute -top-2 left-1/2 -translate-x-1/2 blur-md">shield_lock</span>
                <span className="material-symbols-outlined text-[72px] bg-gradient-to-br from-primary to-emerald-500 bg-clip-text text-transparent relative z-10 animate-floating" style={{ fontVariationSettings: "'FILL' 1, 'wght' 200" }}>shield_lock</span>
              </div>
              
              <h2 className="text-[28px] font-black text-slate-900 dark:text-white tracking-tight leading-none">Acceso Restringido</h2>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mt-3 mb-10">MÓDULO FINANCIERO PROTEGIDO</p>
              
              <form onSubmit={handleSubmit} className="w-full space-y-5">
                <div className="relative">
                  <span className={`material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 transition-colors text-xl ${password.length > 0 ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`}>key</span>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    autoFocus
                    className={`w-full h-16 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl pl-14 pr-14 text-center text-lg font-black ${showPassword ? 'tracking-[0.1em]' : 'tracking-[0.4em]'} focus:ring-4 transition-all placeholder:text-slate-200 dark:placeholder:text-slate-700 dark:text-white ${
                      error 
                      ? 'ring-2 ring-red-500 bg-red-50 dark:bg-red-900/20 text-red-500' 
                      : password.length > 0 
                        ? 'text-emerald-500 ring-4 ring-emerald-500/10' 
                        : 'focus:ring-primary/20 text-slate-400'
                    }`}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl transition-colors"
                    title={showPassword ? "Ocultar clave" : "Ver clave"}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                
                <button 
                  type="submit" 
                  className="w-full h-16 bg-[#0f172a] dark:bg-primary text-white font-black rounded-2xl shadow-xl shadow-slate-900/20 dark:shadow-primary/20 hover:bg-black dark:hover:bg-blue-600 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-[0.15em] text-[11px] flex items-center justify-center gap-3 border-b-4 border-slate-950 dark:border-blue-800"
                >
                  <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
                  DESBLOQUEAR MÓDULO
                </button>
              </form>
              
              <p className="mt-10 text-[9px] font-bold text-slate-300 dark:text-slate-600 italic leading-relaxed max-w-[240px]">
                Esta sección contiene datos sensibles de facturación e ingresos. Solo personal autorizado.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinanceProtection;
