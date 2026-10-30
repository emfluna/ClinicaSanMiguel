
import React, { useState, useMemo } from 'react';
import { Patient } from '../types';
import { supabase } from '../services/supabaseClient';
import { parseTimeToMinutes } from '../utils/timeUtils';
import { sendAppointmentWhatsAppReminder, formatPhoneForWhatsApp, openWhatsAppUrl } from '../utils/whatsappUtils';

interface Appointment {
  id: string;
  patientName: string;
  procedure: string;
  date: string; 
  time: string; 
  color: 'primary' | 'purple' | 'amber' | 'emerald';
  status: 'scheduled' | 'in-progress' | 'completed';
  reminderSet: boolean;
  paciente_id?: string;
}

interface SchedulingProps {
  patients: Patient[];
  appointments: Appointment[];
  setAppointments: (appts?: any) => void;
  onAddAppt?: (apptData: { patientName: string; procedure: string }) => void;
}

const toLocalDateStr = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatToDisplay = (isoDate: string) => {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length < 3) return isoDate;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
};

const formatToISO = (displayDate: string) => {
  if (!displayDate || displayDate.length < 10) return '';
  const [d, m, y] = displayDate.split('/');
  return `${y}-${m}-${d}`;
};

const getApptDotColor = (procedure: string) => {
  const p = procedure.toLowerCase();
  if (p.includes('limpieza') || p.includes('profilaxis')) return 'bg-emerald-400';
  if (p.includes('cirugía') || p.includes('extracción')) return 'bg-rose-500';
  if (p.includes('ortodoncia')) return 'bg-purple-400';
  if (p.includes('blanqueamiento')) return 'bg-cyan-400';
  return 'bg-amber-400';
};

const getMonthTornasolGradient = (month: number) => {
  const gradients = [
    'from-[#0f172a] via-[#1e3a8a] to-[#0f172a]', // Enero
    'from-[#1e1b4b] via-[#4c1d95] to-[#1e1b4b]', // Febrero
    'from-[#022c22] via-[#065f46] to-[#022c22]', // Marzo
    'from-[#451a03] via-[#92400e] to-[#451a03]', // Abril
    'from-[#2e1065] via-[#701a75] to-[#2e1065]', // Mayo
    'from-[#052e16] via-[#14532d] to-[#16a34a]', // Junio (Césped de Estadio / Mundial de Fútbol)
    'from-[#1e3a8a] via-[#1d4ed8] to-[#15803d]', // Julio (Luces de Estadio y Césped / Mundial de Fútbol)
    'from-[#450a0a] via-[#991b1b] to-[#450a0a]', // Agosto
    'from-[#064e3b] via-[#15803d] to-[#064e3b]', // Septiembre
    'from-[#431407] via-[#9a3412] to-[#431407]', // Octubre
    'from-[#0c4a6e] via-[#0284c7] to-[#0c4a6e]', // Noviembre
    'from-[#1e1b4b] via-[#312e81] to-[#1e1b4b]', // Diciembre
  ];
  return gradients[month] || gradients[0];
};

const Scheduling: React.FC<SchedulingProps> = ({ patients, appointments, setAppointments, onAddAppt }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [editingAppt, setEditingAppt] = useState<any>(null);
  const [manualName, setManualName] = useState('');
  const [dateDisplay, setDateDisplay] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [authDeleteId, setAuthDeleteId] = useState<string | null>(null);
  const [authKey, setAuthKey] = useState('');

  const [showSuggestions, setShowSuggestions] = useState(false);

  const autocompleteSuggestions = useMemo(() => {
    const normalize = (str: string) => 
      str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    const query = normalize(manualName.trim());
    if (!query) return [];

    const matchesName = (fullName: string) => {
      const normalizedFullName = normalize(fullName || '');
      return normalizedFullName.includes(query);
    };

    const list: { id?: string; name: string; type: 'registered' | 'external' }[] = [];

    // 1. Registered patients
    patients.forEach(p => {
      const pName = p.name || '';
      if (matchesName(pName)) {
        list.push({
          id: p.id,
          name: pName,
          type: 'registered'
        });
      }
    });

    // 2. Scheduled external patients
    const externalNames = new Set<string>();
    appointments.forEach(appt => {
      if (!appt.paciente_id) {
        const cleanName = (appt.patientName || '').trim();
        if (cleanName && matchesName(cleanName)) {
          const alreadyRegistered = patients.some(p => (p.name || '').toLowerCase() === cleanName.toLowerCase());
          if (!alreadyRegistered && !externalNames.has(cleanName.toLowerCase())) {
            externalNames.add(cleanName.toLowerCase());
            list.push({
              name: cleanName,
              type: 'external'
            });
          }
        }
      }
    });

    return list.slice(0, 5);
  }, [manualName, patients, appointments]);

  const handleSelectSuggestion = (suggestion: { id?: string; name: string; type: 'registered' | 'external' }) => {
    if (suggestion.type === 'registered' && suggestion.id) {
      setEditingAppt((prev: any) => ({ ...prev, paciente_id: suggestion.id }));
      setManualName('');
    } else {
      setManualName(suggestion.name.toUpperCase());
    }
    setShowSuggestions(false);
  };

  const selectedDateStr = toLocalDateStr(currentDate);

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const calendar = [];
    for (let i = 0; i < firstDay; i++) calendar.push(null);
    for (let i = 1; i <= days; i++) calendar.push(new Date(year, month, i));
    return calendar;
  }, [currentDate]);

  const todaysBirthdays = useMemo(() => {
    const month = currentDate.getMonth() + 1;
    const day = currentDate.getDate();
    return patients.filter(p => {
      if (!p.fecha_nacimiento) return false;
      const [py, pm, pd] = p.fecha_nacimiento.split('-').map(Number);
      return pm === month && pd === day;
    });
  }, [patients, currentDate]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 8) val = val.slice(0, 8);
    let formatted = val;
    if (val.length > 2 && val.length <= 4) formatted = `${val.slice(0, 2)}/${val.slice(2)}`;
    else if (val.length > 4) formatted = `${val.slice(0, 2)}/${val.slice(2, 4)}/${val.slice(4)}`;
    setDateDisplay(formatted);
  };

  const handleSaveAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAppt) return;
    const isoDate = formatToISO(dateDisplay);
    if (!isoDate) { alert("Fecha inválida"); return; }
    setIsSaving(true);
    
    const patientObj = patients.find(p => p.id === editingAppt.paciente_id);
    const resolvedPatientName = patientObj ? patientObj.name : manualName.trim();
    
    const finalProcedure = editingAppt.paciente_id ? editingAppt.procedure : `${manualName.trim().toUpperCase() || 'NUEVO PACIENTE'} | ${editingAppt.procedure}`;
    const dbPayload = { paciente_id: editingAppt.paciente_id || null, fecha: isoDate, hora: editingAppt.time, motivo: finalProcedure, estado: editingAppt.status === 'completed' ? 'completado' : 'scheduled' };
    try {
      if (editingAppt.id) await supabase.from('citas').update(dbPayload).eq('id', editingAppt.id);
      else { 
        await supabase.from('citas').insert([dbPayload]); 
        if (onAddAppt) onAddAppt({ patientName: resolvedPatientName, procedure: editingAppt.procedure }); 
      }
      // Sincronizar el caché del backend en tiempo real
      fetch('/api/notifications/sync', { method: 'POST' }).catch(err => console.error(err));
      setShowModal(false); setEditingAppt(null); setManualName(''); setAppointments(); 
    } catch (err) { alert("Error al guardar"); } finally { setIsSaving(false); }
  };

  const confirmDelete = async () => {
    if (authKey === '12') {
      try { 
        await supabase.from('citas').delete().eq('id', authDeleteId); 
        // Sincronizar el caché del backend en tiempo real
        fetch('/api/notifications/sync', { method: 'POST' }).catch(err => console.error(err));
        setAppointments(); setAuthDeleteId(null); setAuthKey(''); 
      } catch (err) { alert("Error al eliminar"); }
    } else { alert("Clave incorrecta"); }
  };

  const openCreateModal = () => {
    setEditingAppt({ date: selectedDateStr, time: '09:00', status: 'scheduled', procedure: '', paciente_id: '' }); 
    setManualName(''); setDateDisplay(formatToDisplay(selectedDateStr)); setShowModal(true);
  };

  const sendWhatsAppRemind = (appt: Appointment) => {
    sendAppointmentWhatsAppReminder(appt, patients);
  };

  const sendWhatsAppBirthday = (p: Patient) => {
    let phone = formatPhoneForWhatsApp(p.phone);
    if (!phone) {
      const manualPhone = window.prompt(`No se encontró número registrado para "${p.name}". Ingrese el número de WhatsApp:`);
      if (manualPhone) {
        phone = formatPhoneForWhatsApp(manualPhone);
      }
    }
    if (!phone) return;
    const message = `¡Hola ${p.nombres || p.name}! 🎉 Dental San Miguel te desea un ¡Feliz Cumpleaños! 🎂 Que pases un día increíble lleno de alegría y sonrisas. Gracias por confiar en nosotros. 🦷✨`;
    openWhatsAppUrl(phone, message);
  };

  const filtered = useMemo(() => {
    return appointments
      .filter(a => a.date === selectedDateStr)
      .sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
  }, [appointments, selectedDateStr]);

  return (
    <div className="flex flex-col h-full bg-[#020617] overflow-hidden">
      <div className="flex-1 overflow-y-auto scrollbar-hide p-3 lg:p-6 space-y-4">
        
        {/* HEADER */}
        <div className="bg-[#111827] rounded-[32px] p-6 border border-white/5 flex flex-col sm:flex-row justify-between items-center gap-6 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary/40 group-hover:bg-primary transition-all"></div>
          <div className="flex items-center gap-5">
            <div className="size-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
              <span className="material-symbols-outlined text-3xl">event_upcoming</span>
            </div>
            <div className="leading-tight">
              <h2 className="text-[28px] font-black tracking-tighter text-white leading-none uppercase">AGENDA</h2>
              <p className="text-[7px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2">SM DENTAL • RECORDATORIOS ACTIVOS</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={openCreateModal}
              className="w-full sm:w-auto bg-primary text-white h-14 px-8 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 border-b-4 border-blue-700"
            >
              <span className="material-symbols-outlined text-xl">add_task</span> 
              NUEVA CITA
            </button>
          </div>
        </div>

        {/* CALENDARIO TORNASOL */}
        <div className={`rounded-[40px] p-8 border border-white/5 shadow-2xl relative overflow-hidden transition-all duration-700 bg-gradient-to-br ${getMonthTornasolGradient(currentDate.getMonth())}`}>
          <div className="absolute inset-0 bg-[#000000]/30 backdrop-blur-[1px] pointer-events-none"></div>
          
          {/* Marcador de campo de fútbol para Junio y Julio */}
          {(currentDate.getMonth() === 5 || currentDate.getMonth() === 6) && (
            <>
              <div className="absolute inset-0 pointer-events-none opacity-[0.06] flex flex-col justify-between p-8">
                <div className="border-4 border-dashed border-white h-full w-full rounded-[24px] relative flex items-center justify-center">
                  <div className="absolute left-0 right-0 h-1 bg-white top-1/2 -translate-y-1/2"></div>
                  <div className="size-40 border-4 border-white rounded-full flex items-center justify-center">
                    <div className="size-3 bg-white rounded-full"></div>
                  </div>
                  <div className="absolute top-0 w-48 h-24 border-b-4 border-x-4 border-white left-1/2 -translate-x-1/2"></div>
                  <div className="absolute bottom-0 w-48 h-24 border-t-4 border-x-4 border-white left-1/2 -translate-x-1/2"></div>
                </div>
              </div>
              
              {/* Balones de fútbol decorativos flotantes en las esquinas del fondo */}
              <div className="absolute top-4 right-32 text-3xl opacity-[0.18] animate-bounce pointer-events-none select-none" style={{ animationDuration: '4s' }}>⚽</div>
              <div className="absolute bottom-12 left-6 text-4xl opacity-[0.15] animate-spin pointer-events-none select-none" style={{ animationDuration: '12s' }}>⚽</div>
              <div className="absolute top-1/2 right-4 text-2xl opacity-[0.12] animate-pulse pointer-events-none select-none" style={{ animationDuration: '3s' }}>⚽</div>
              <div className="absolute bottom-6 right-24 text-3xl opacity-[0.2] animate-bounce pointer-events-none select-none" style={{ animationDuration: '5.5s' }}>⚽</div>
            </>
          )}
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex items-baseline gap-3">
                  <h3 className="text-4xl font-black text-white capitalize tracking-tighter drop-shadow-lg">
                    {currentDate.toLocaleDateString('es-ES', { month: 'long' })}
                  </h3>
                  <span className="text-white/40 text-lg font-black">{currentDate.getFullYear()}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="size-11 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl flex items-center justify-center text-white hover:bg-white/20 transition-all shadow-sm"><span className="material-symbols-outlined">chevron_left</span></button>
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="size-11 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl flex items-center justify-center text-white hover:bg-white/20 transition-all shadow-sm"><span className="material-symbols-outlined">chevron_right</span></button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-2">
              {['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'].map(day => (
                <div key={day} className="py-2 text-center text-[9px] font-black text-white/50 uppercase tracking-widest">{day}</div>
              ))}
              {calendarDays.map((date, idx) => {
                if (!date) return <div key={idx}></div>;
                const iso = toLocalDateStr(date);
                const isSel = iso === selectedDateStr;
                const dayAppts = appointments
                  .filter(a => a.date === iso)
                  .sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
                const isToday = iso === toLocalDateStr(new Date());
                const isWC = currentDate.getMonth() === 5 || currentDate.getMonth() === 6;
                
                const hasBirthday = patients.some(p => {
                  if(!p.fecha_nacimiento) return false;
                  const [, pm, pd] = p.fecha_nacimiento.split('-').map(Number);
                  return pm === (date.getMonth()+1) && pd === date.getDate();
                });

                return (
                  <div 
                    key={idx} 
                    onClick={() => { setCurrentDate(date); setDateDisplay(formatToDisplay(iso)); }} 
                    className={`relative aspect-square flex flex-col items-center justify-center rounded-[22px] cursor-pointer transition-all duration-300 border-2 group ${
                      isSel 
                        ? isWC 
                          ? 'bg-yellow-400 border-yellow-300 text-slate-950 shadow-2xl shadow-yellow-500/30 scale-110' 
                          : 'bg-white border-white text-slate-900 shadow-2xl scale-110' 
                        : isWC
                          ? 'bg-emerald-950/40 border-emerald-500/10 hover:bg-emerald-900/50 hover:border-emerald-400/30'
                          : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <span className={`text-[17px] font-black ${isSel ? 'text-slate-950' : (isToday ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'text-white/80')}`}>
                      {date.getDate()}
                    </span>
                    
                    {hasBirthday && !isSel && (
                      <div className="absolute top-1 right-1 text-amber-400 drop-shadow-md animate-bounce">
                        <span className="material-symbols-outlined text-[10px] font-black">cake</span>
                      </div>
                    )}

                    {isToday && isWC && !isSel && (
                      <div className="absolute top-1 left-1.5 text-[8px] animate-pulse drop-shadow-sm select-none">
                        ⚽
                      </div>
                    )}

                    <div className="absolute bottom-2 flex flex-wrap justify-center gap-0.5 max-w-[90%] px-1">
                      {dayAppts.map((a, i) => {
                        const totalAppts = dayAppts.length;
                        const sizeClass = 
                          totalAppts <= 2 ? 'size-2' : 
                          totalAppts <= 4 ? 'size-1.5' : 
                          totalAppts <= 6 ? 'size-[5px]' : 
                          totalAppts <= 8 ? 'size-[4px]' : 'size-[3px]';
                        return (
                          <div 
                            key={i} 
                            className={`${sizeClass} rounded-full ${isSel ? 'bg-slate-950' : getApptDotColor(a.procedure)} shadow-sm transition-transform group-hover:scale-125`}
                            title={`${a.patientName}: ${a.procedure}`}
                          ></div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* CONTENIDO DEL DÍA (CUMPLEN & CITAS) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* CUMPLEAÑOS */}
          {todaysBirthdays.length > 0 && (
            <div className="lg:col-span-12 bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-amber-500/10 rounded-[32px] p-6 border border-amber-500/30 shadow-xl animate-in slide-in-from-top-4 duration-500">
               <div className="flex items-center gap-4 mb-4">
                  <div className="size-10 bg-amber-500 text-white rounded-xl flex items-center justify-center shadow-lg animate-floating">
                    <span className="material-symbols-outlined">cake</span>
                  </div>
                  <h3 className="text-[14px] font-black text-amber-500 uppercase tracking-[0.2em]">¡CUMPLEAÑOS DE HOY! ({todaysBirthdays.length})</h3>
               </div>
               <div className="flex flex-wrap gap-4">
                 {todaysBirthdays.map(p => (
                   <div key={p.id} className="flex items-center gap-4 bg-[#111827] border border-amber-500/20 p-4 rounded-2xl shadow-lg min-w-[280px]">
                      <img src={p.photo} className="size-12 rounded-xl object-cover border-2 border-amber-500/20" />
                      <div className="flex-1">
                        <p className="text-sm font-black text-white leading-tight">{p.name.toUpperCase()}</p>
                        <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mt-1">Socio Dental Preferente</p>
                      </div>
                      <button 
                        onClick={() => sendWhatsAppBirthday(p)}
                        className="size-10 bg-[#25D366] text-white rounded-xl flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-lg animate-whatsapp-pulse"
                        title="Enviar Saludo Bonito"
                      >
                        <span className="material-symbols-outlined">celebration</span>
                      </button>
                   </div>
                 ))}
               </div>
            </div>
          )}

          {/* CITAS */}
          <div className="lg:col-span-12 bg-[#111827] rounded-[40px] p-8 border border-white/5 shadow-2xl min-h-[400px]">
            <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-4">
                  <div className="size-3 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_15px_rgba(52,211,153,0.8)]"></div>
                  <h3 className="text-[16px] font-black text-white uppercase tracking-[0.2em]">Lista de Atención: {filtered.length} Pacientes</h3>
               </div>
               <div className="px-6 py-2.5 bg-primary/20 border border-primary/20 rounded-full text-[10px] font-black text-primary uppercase tracking-[0.2em] shadow-inner">
                  {selectedDateStr === toLocalDateStr(new Date()) ? 'Atención Hoy' : formatToDisplay(selectedDateStr)}
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(appt => (
                <div key={appt.id} className={`p-6 rounded-[28px] border-2 bg-[#0f172a] shadow-xl group transition-all hover:scale-[1.02] flex flex-col justify-between gap-4 border-slate-800/60 hover:border-primary/40`}>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 text-white px-4 py-2 rounded-2xl font-black text-lg shadow-inner">
                         {appt.time}
                      </div>
                      <div className="flex flex-col">
                        <h4 className="text-[15px] font-black text-white uppercase tracking-tight truncate max-w-[150px]">{appt.patientName}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                           <div className={`size-2 rounded-full ${getApptDotColor(appt.procedure)}`}></div>
                           <p className="text-[9px] font-bold text-slate-400 uppercase truncate tracking-widest">{appt.procedure}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                       <button 
                        onClick={() => sendWhatsAppRemind(appt)}
                        className="size-11 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all shadow-sm border border-emerald-500/20"
                        title="Recordar Cita"
                       >
                         <span className="material-symbols-outlined text-xl">send_and_archive</span>
                       </button>
                       <button 
                        onClick={() => setAuthDeleteId(appt.id)} 
                        className="size-11 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-lg border border-rose-500/20"
                        title="Anular Cita"
                       >
                        <span className="material-symbols-outlined text-xl">close</span>
                       </button>
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="col-span-full py-20 flex flex-col items-center justify-center opacity-10 gap-6 grayscale">
                  <span className="material-symbols-outlined text-[100px] font-light">calendar_add_on</span>
                  <p className="text-[12px] font-black uppercase tracking-[0.4em] text-white">Sin pacientes programados para esta fecha</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL ELIMINAR (Protección Clave 12) */}
      {authDeleteId && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/95 backdrop-blur-xl p-4 animate-in fade-in">
          <div className="bg-[#111827] p-12 rounded-[56px] border-4 border-white/5 w-full max-w-sm text-center shadow-2xl">
             <div className="size-20 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-rose-500/20">
               <span className="material-symbols-outlined text-4xl">security</span>
             </div>
            <h3 className="text-white font-black text-xl uppercase mb-2 tracking-tight">Autorización Requerida</h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-10">Anulación de registro clínico</p>
            <input type="password" autoFocus className="w-full h-20 bg-slate-900 border-none rounded-[28px] text-center text-4xl text-white font-black tracking-[0.5em] mb-10 shadow-inner focus:ring-4 ring-primary/20" placeholder="••" value={authKey} onChange={e=>setAuthKey(e.target.value)} onKeyDown={e=>e.key==='Enter' && confirmDelete()} />
            <div className="flex gap-4">
              <button onClick={() => {setAuthDeleteId(null); setAuthKey('');}} className="flex-1 h-16 bg-slate-800 text-slate-400 rounded-2xl font-black text-[11px] uppercase tracking-widest">CANCELAR</button>
              <button onClick={confirmDelete} className="flex-1 h-16 bg-rose-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 border-b-4 border-rose-800">ELIMINAR</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR CITA */}
      {showModal && editingAppt && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in zoom-in duration-200">
          <div className="bg-[#111827] w-full max-w-md rounded-[56px] border-4 border-white/5 p-12 shadow-2xl">
             <div className="flex items-center gap-5 mb-10">
                <div className="size-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-inner">
                   <span className="material-symbols-outlined text-3xl">add_circle</span>
                </div>
                <div>
                   <h3 className="text-[28px] font-black text-white uppercase tracking-tighter leading-none">PROGRAMAR</h3>
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-2">NUEVA ENTRADA DE AGENDA</p>
                </div>
             </div>
             <form onSubmit={handleSaveAppointment} className="space-y-6">
                <div className="space-y-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">PACIENTE</label>
                      <select className="w-full h-16 bg-slate-900 border-none rounded-[24px] px-8 text-[14px] font-black text-white focus:ring-4 ring-primary/10 appearance-none shadow-inner uppercase" value={editingAppt.paciente_id || ''} onChange={e => setEditingAppt({...editingAppt, paciente_id: e.target.value})}>
                        <option value="">+ PACIENTE EXTERNO</option>
                        {patients.map(p => <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>)}
                      </select>
                   </div>
                    {!editingAppt.paciente_id && (
                      <div className="relative">
                        <input
                          required
                          type="text"
                          className="w-full h-16 bg-slate-900 border-none rounded-[24px] px-8 text-[14px] font-black text-white uppercase placeholder:text-slate-800 shadow-inner"
                          value={manualName}
                          onChange={e => {
                            setManualName(e.target.value);
                            setShowSuggestions(true);
                          }}
                          onFocus={() => setShowSuggestions(true)}
                          onBlur={() => {
                            setTimeout(() => setShowSuggestions(false), 240);
                          }}
                          placeholder="NOMBRE DEL PACIENTE..."
                        />
                        {showSuggestions && autocompleteSuggestions.length > 0 && (
                          <div className="absolute z-[1010] left-0 right-0 mt-2 bg-[#0f172a] border border-white/10 rounded-[24px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-t-2 max-h-60 overflow-y-auto scrollbar-hide">
                            <div className="p-2 space-y-1">
                              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-4 py-2">
                                PACIENTES COINCIDENTES ({autocompleteSuggestions.length})
                              </p>
                              {autocompleteSuggestions.map((item, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => handleSelectSuggestion(item)}
                                  className="w-full flex items-center justify-between px-5 py-3 rounded-[16px] hover:bg-white/5 text-left transition-all group"
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-[18px] text-slate-400 group-hover:text-primary transition-colors">
                                      person
                                    </span>
                                    <span className="text-[12px] font-black text-white uppercase group-hover:text-primary transition-colors">
                                      {item.name}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                   <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">MOTIVO / TRATAMIENTO</label>
                    <input required type="text" className="w-full h-16 bg-slate-900 border-none rounded-[24px] px-8 text-[14px] font-black text-white placeholder:text-slate-800 shadow-inner uppercase" value={editingAppt.procedure} onChange={e => setEditingAppt({...editingAppt, procedure: e.target.value})} placeholder="EJ: PROFILAXIS, RESINA..." />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">FECHA</label>
                        <input type="text" required placeholder="DD/MM/AAAA" className="w-full h-16 bg-slate-900 border-none rounded-[24px] text-[14px] font-black text-white text-center shadow-inner" value={dateDisplay} onChange={handleDateChange} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">HORA</label>
                        <input type="time" required className="w-full h-16 bg-slate-900 border-none rounded-[24px] text-[14px] font-black text-white text-center shadow-inner" value={editingAppt.time} onChange={e => setEditingAppt({...editingAppt, time: e.target.value})} />
                      </div>
                   </div>
                </div>
                <div className="flex gap-4 pt-4">
                   <button type="button" onClick={() => setShowModal(false)} className="flex-1 h-16 bg-slate-800/50 text-slate-400 font-black rounded-[24px] uppercase text-[11px] tracking-widest hover:bg-slate-700 transition-all">DESCARTAR</button>
                   <button type="submit" disabled={isSaving} className="flex-1 h-16 bg-primary text-white font-black rounded-[24px] uppercase text-[11px] tracking-widest shadow-xl active:scale-95 border-b-4 border-blue-700">GUARDAR</button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scheduling;
