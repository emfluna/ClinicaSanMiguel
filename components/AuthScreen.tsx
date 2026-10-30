
import React, { useState } from 'react';
import { User } from '../types';
import { supabase } from '../services/supabaseClient';

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError('Credenciales incorrectas o acceso no autorizado.');
      } else if (data.user) {
        const loggedUser: User = {
          id: data.user.id,
          name: data.user.user_metadata?.full_name || email.split('@')[0],
          email: data.user.email || email,
          photo: data.user.user_metadata?.photo_url || '',
          password: password 
        };
        onLogin(loggedUser);
      }
    } catch (err) {
      setError('Error de conexión con el servidor de seguridad.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] transition-colors duration-300">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-10 flex flex-col items-center">
          <div className="flex items-center gap-4 mb-2">
            <div className="text-[#1a5eb0] dark:text-blue-400">
              <span className="material-symbols-outlined text-[64px]" style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}>dentistry</span>
            </div>
            <div className="flex flex-col items-start leading-none text-left">
              <span className="text-[#1a5eb0] dark:text-blue-400 text-[24px] font-black tracking-tight uppercase">Clínica Dental</span>
              <span className="text-[#1a5eb0] dark:text-blue-400 text-[28px] font-black tracking-tighter uppercase">San Miguel</span>
            </div>
          </div>
          <div className="w-full max-w-[280px]">
            <div className="h-[3px] w-full bg-gradient-to-r from-transparent via-[#4fd1c5] to-transparent rounded-full mb-1"></div>
            <p className="text-[#f9b115] text-[10px] font-black uppercase tracking-[0.3em]">Odontología Integral</p>
          </div>
          <p className="text-slate-400 dark:text-slate-500 font-bold mt-8 uppercase tracking-widest text-[9px] bg-white dark:bg-slate-900 px-4 py-1.5 rounded-full border border-slate-100 dark:border-slate-800 shadow-sm transition-colors">
            Acceso Privado y Restringido
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-10 lg:p-12 rounded-[48px] shadow-2xl border border-slate-100 dark:border-slate-800 relative overflow-hidden transition-all">
          <div className="absolute top-0 left-0 w-full h-2.5 bg-[#1a5eb0] dark:bg-blue-500"></div>
          
          <form onSubmit={handleLogin} className="space-y-7">
            <div className="text-center mb-4">
               <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Iniciar Sesión</h2>
               <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Panel Administrativo</p>
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl border border-red-100 dark:border-red-900/30 flex items-center gap-3 animate-shake">
                <span className="material-symbols-outlined text-lg">error</span>
                <p className="text-xs font-black uppercase tracking-tight">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Correo Autorizado</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 group-focus-within:text-primary transition-colors">mail</span>
                <input 
                  type="email" 
                  required 
                  className="w-full h-16 bg-slate-50 dark:bg-slate-800 border-none rounded-3xl pl-14 pr-6 text-sm font-black text-slate-900 dark:text-white focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-slate-200 dark:placeholder:text-slate-700"
                  placeholder="ejemplo@clinicarsm.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Contraseña</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 group-focus-within:text-primary transition-colors">lock</span>
                <input 
                  type="password" 
                  required 
                  className="w-full h-16 bg-slate-50 dark:bg-slate-800 border-none rounded-3xl pl-14 pr-6 text-sm font-black text-slate-900 dark:text-white focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-slate-200 dark:placeholder:text-slate-700"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full h-16 bg-[#1a5eb0] dark:bg-blue-600 text-white font-black rounded-3xl shadow-xl shadow-blue-500/20 hover:bg-blue-700 dark:hover:bg-blue-500 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="material-symbols-outlined animate-spin">sync</span>
              ) : (
                <span className="material-symbols-outlined">login</span>
              )}
              INGRESAR AL SISTEMA
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-50 dark:border-slate-800 text-center flex flex-col items-center gap-2">
             <span className="material-symbols-outlined text-slate-200 dark:text-slate-700 text-3xl">verified_user</span>
             <p className="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.3em]">Seguridad por Criptografía de Extremo a Extremo</p>
          </div>
        </div>
        
        <p className="mt-8 text-center text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em]">
          © 2024 CLÍNICA DENTAL SAN MIGUEL • DERECHOS RESERVADOS • BY EFML
        </p>
      </div>
    </div>
  );
};

export default AuthScreen;
