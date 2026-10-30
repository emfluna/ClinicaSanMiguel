import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { RecentActivity } from '../types';

interface ActivityFeedProps {
  onSelectPatientByName?: (patientName: string) => void;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ onSelectPatientByName }) => {
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showFullModal, setShowFullModal] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const fetchActivities = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('actividades')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (data) {
        const mapped: RecentActivity[] = data.map((a: any) => ({
          id: a.id,
          type: a.type as RecentActivity['type'],
          description: a.description || 'OPERACIÓN EN SISTEMA',
          patientName: a.patient_name || 'SISTEMA',
          timestamp: a.created_at || new Date().toISOString(),
          amount: a.amount,
          author: a.author
        }));
        setActivities(mapped);
      }
    } catch (err) {
      console.error('Error al cargar actividades recientes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();

    // Suscripción en tiempo real a nuevas actividades
    const channel = supabase
      .channel('actividades_feed_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'actividades' },
        (payload: any) => {
          const newAct = payload.new;
          if (newAct) {
            const mappedNew: RecentActivity = {
              id: newAct.id,
              type: newAct.type as RecentActivity['type'],
              description: newAct.description || 'OPERACIÓN EN SISTEMA',
              patientName: newAct.patient_name || 'SISTEMA',
              timestamp: newAct.created_at || new Date().toISOString(),
              amount: newAct.amount,
              author: newAct.author
            };
            setActivities(prev => [mappedNew, ...prev].slice(0, 50));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'income':
        return { icon: 'payments', bg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
      case 'note':
        return { icon: 'edit_note', bg: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };
      case 'update':
        return { icon: 'manage_accounts', bg: 'bg-blue-500/10 text-blue-500 border-blue-500/20' };
      case 'delete':
        return { icon: 'delete_sweep', bg: 'bg-rose-500/10 text-rose-500 border-rose-500/20' };
      case 'photo':
        return { icon: 'add_a_photo', bg: 'bg-purple-500/10 text-purple-500 border-purple-500/20' };
      case 'appointment':
        return { icon: 'calendar_clock', bg: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' };
      case 'inventory':
        return { icon: 'inventory_2', bg: 'bg-orange-500/10 text-orange-500 border-orange-500/20' };
      default:
        return { icon: 'history', bg: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
    }
  };

  const formatRelativeTime = (isoString: string) => {
    if (!isoString) return 'Hace un momento';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Hace unos segundos';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays === 1) return 'Ayer';
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const getAuthorName = (authorStr?: string) => {
    if (!authorStr) return 'Sistema';
    return authorStr.split('|')[0].trim() || 'Sistema';
  };

  const lastFive = activities.slice(0, 5);

  const filteredFullList = activities.filter(act => {
    const matchesType = filterType === 'all' || act.type === filterType;
    const matchesSearch = 
      act.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      act.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (act.author && act.author.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesType && matchesSearch;
  });

  return (
    <>
      {/* TARJETA COMPACTA DE ACTIVIDAD RECIENTE (5 ÚLTIMAS OPERACIONES) */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between transition-all">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2.5">
            <div className="size-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
            <h3 className="font-black text-base lg:text-lg text-slate-900 dark:text-white tracking-tight uppercase">
              Actividad Reciente
            </h3>
          </div>
          <button
            onClick={() => setShowFullModal(true)}
            className="text-[9px] font-black text-primary hover:text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-primary/10 dark:bg-primary/20 hover:bg-primary/20 px-3 py-1.5 rounded-xl border border-primary/20 transition-all flex items-center gap-1 active:scale-95"
            title="Ver auditoría e historial completo"
          >
            <span>VER HISTORIAL</span>
            <span className="material-symbols-outlined text-sm">open_in_full</span>
          </button>
        </div>

        {/* CONTENIDO DE LAS 5 ACTIVIDADES */}
        <div className="space-y-2.5">
          {isLoading ? (
            <div className="py-8 text-center space-y-2">
              <span className="material-symbols-outlined text-2xl text-slate-400 animate-spin">progress_activity</span>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cargando eventos...</p>
            </div>
          ) : lastFive.length === 0 ? (
            <div className="py-8 text-center text-slate-400 opacity-60">
              <span className="material-symbols-outlined text-3xl">history_toggle_off</span>
              <p className="text-[10px] font-bold uppercase tracking-widest mt-1">Sin actividades registradas hoy</p>
            </div>
          ) : (
            lastFive.map(act => {
              const style = getActivityIcon(act.type);
              return (
                <div
                  key={act.id}
                  onClick={() => act.patientName && onSelectPatientByName && onSelectPatientByName(act.patientName)}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800/80 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`size-9 rounded-xl flex items-center justify-center border shrink-0 ${style.bg} transition-transform group-hover:scale-105`}>
                      <span className="material-symbols-outlined text-lg">{style.icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] font-black text-slate-800 dark:text-slate-200 truncate uppercase tracking-tight leading-tight group-hover:text-primary transition-colors">
                          {act.description}
                        </p>
                        {act.amount !== undefined && act.amount > 0 && (
                          <span className="text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20 shrink-0">
                            S/ {act.amount.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 truncate uppercase mt-0.5">
                        {act.patientName} • <span className="text-slate-500 dark:text-slate-400">{getAuthorName(act.author)}</span>
                      </p>
                    </div>
                  </div>
                  <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 shrink-0 ml-2 uppercase">
                    {formatRelativeTime(act.timestamp)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL DE HISTORIAL COMPLETO DE AUDITORÍA */}
      {showFullModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111827] w-full max-w-3xl rounded-[36px] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh] overflow-hidden">
            {/* Header del Modal */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="size-10 bg-primary/10 text-primary rounded-2xl flex items-center justify-center border border-primary/20">
                  <span className="material-symbols-outlined text-2xl">history</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    Historial de Operaciones y Auditoría
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    REGISTRO DETALLADO DE CAMBIOS EN TIEMPO REAL
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFullModal(false)}
                className="size-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-rose-500 hover:text-white text-slate-500 dark:text-slate-400 flex items-center justify-center transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Filtros e Insumos de Búsqueda */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3 bg-white dark:bg-slate-900">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                <input
                  type="text"
                  placeholder="Buscar por paciente, acción o usuario..."
                  className="w-full h-10 bg-slate-50 dark:bg-slate-800 border-none rounded-xl pl-10 pr-4 text-xs font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="h-10 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-3 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-primary/20 uppercase cursor-pointer"
              >
                <option value="all">TODOS LOS EVENTOS</option>
                <option value="income">INGRESOS / PAGOS</option>
                <option value="note">NOTAS CLÍNICAS</option>
                <option value="update">ACTUALIZACIONES</option>
                <option value="photo">IMÁGENES HD</option>
                <option value="appointment">CITAS</option>
                <option value="delete">ELIMINACIONES</option>
              </select>

              <button
                onClick={fetchActivities}
                className="size-10 bg-slate-100 dark:bg-slate-800 hover:bg-primary hover:text-white text-slate-600 dark:text-slate-300 rounded-xl flex items-center justify-center transition-all active:scale-95 shrink-0"
                title="Actualizar lista"
              >
                <span className="material-symbols-outlined text-lg">refresh</span>
              </button>
            </div>

            {/* Lista Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-slate-50/40 dark:bg-slate-950/40 scrollbar-hide">
              {filteredFullList.length === 0 ? (
                <div className="py-16 text-center space-y-2 opacity-50">
                  <span className="material-symbols-outlined text-4xl text-slate-400">search_off</span>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">No se encontraron actividades con estos criterios</p>
                </div>
              ) : (
                filteredFullList.map(act => {
                  const style = getActivityIcon(act.type);
                  return (
                    <div
                      key={act.id}
                      className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 shadow-sm hover:border-primary/20 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`size-10 rounded-2xl flex items-center justify-center border shrink-0 ${style.bg}`}>
                          <span className="material-symbols-outlined text-xl">{style.icon}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                              {act.description}
                            </span>
                            {act.amount !== undefined && act.amount > 0 && (
                              <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                S/ {act.amount.toLocaleString()}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mt-0.5">
                            Paciente: <strong className="text-slate-700 dark:text-slate-200">{act.patientName}</strong> • Autor: {getAuthorName(act.author)}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase">
                          {formatRelativeTime(act.timestamp)}
                        </p>
                        <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-0.5">
                          {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <span>MOSTRANDO {filteredFullList.length} REGISTROS</span>
              <button
                onClick={() => setShowFullModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all active:scale-95"
              >
                CERRAR
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ActivityFeed;
