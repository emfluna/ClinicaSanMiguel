
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Patient, ViewMode, InventoryNote } from '../types';
import { parseTimeToMinutes } from '../utils/timeUtils';
import { sendAppointmentWhatsAppReminder } from '../utils/whatsappUtils';
import ActivityFeed from './ActivityFeed';

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

interface DashboardProps {
  patients: Patient[];
  appointments: Appointment[];
  inventoryNotes: InventoryNote[];
  onSelectPatient: (id: string) => void;
  onViewChange?: (view: ViewMode) => void;
  lastSync?: string;
  isSyncing?: boolean;
}

const displayDate = (dateStr: string | undefined) => {
  if (!dateStr) return '---';
  const rawDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
  const parts = rawDate.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
};

const getTodayDateStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5 fill-current" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.393 0 12.03c0 2.123.556 4.197 1.612 6.01L0 24l6.117-1.605a11.803 11.803 0 005.925 1.585h.005c6.635 0 12.032-5.396 12.035-12.034a11.761 11.761 0 00-3.414-8.244z"/>
  </svg>
);

const Dashboard: React.FC<DashboardProps> = ({ patients, appointments, inventoryNotes, onSelectPatient, onViewChange, lastSync, isSyncing }) => {
  const todayStr = getTodayDateStr();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [showCalendar, setShowCalendar] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const calendarRef = useRef<HTMLDivElement>(null);

  const [debtPage, setDebtPage] = useState(1);
  const itemsPerPage = 10;

  const isWC = new Date().getMonth() === 5 || new Date().getMonth() === 6; // Junio o Julio (Mundial)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    };
    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCalendar]);

  const filteredAppointments = useMemo(() => {
    return appointments
      .filter(appt => appt.date === selectedDate)
      .sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
  }, [appointments, selectedDate]);

  const selectedDayIncome = useMemo(() => {
    let pen = 0;
    let usd = 0;
    patients.forEach(p => {
      p.advancePayments?.forEach(pay => {
        const payDate = pay.date ? (pay.date.includes('T') ? pay.date.split('T')[0] : pay.date.split(' ')[0]) : '';
        const type = pay.type?.toLowerCase() || 'abono';
        if (payDate === selectedDate && type === 'abono') {
          if (pay.currency === 'USD') usd += (pay.amount || 0);
          else pen += (pay.amount || 0);
        }
      });
    });
    return { pen, usd };
  }, [patients, selectedDate]);

  const pendingInventoryCount = useMemo(() => {
    return inventoryNotes.filter(note => note.status !== 'completed').length;
  }, [inventoryNotes]);

  const patientsWithDebt = useMemo(() => {
    return patients.map(patient => {
      let penAbonos = 0, usdAbonos = 0, penCargos = 0, usdCargos = 0;
      patient.advancePayments?.forEach(p => {
        const amt = p.amount || 0;
        const type = p.type?.toLowerCase();
        if (p.currency === 'USD') { if (type === 'abono') usdAbonos += amt; else usdCargos += amt; }
        else { if (type === 'abono') penAbonos += amt; else penCargos += amt; }
      });
      const penDebt = penCargos - penAbonos;
      const usdDebt = usdCargos - usdAbonos;
      if (penDebt > 0 || usdDebt > 0) return { patient, penDebt, usdDebt };
      return null;
    }).filter(Boolean) as { patient: Patient; penDebt: number; usdDebt: number }[];
  }, [patients]);

  const totalDebtPages = Math.ceil(patientsWithDebt.length / itemsPerPage) || 1;

  const paginatedDebts = useMemo(() => {
    const startIndex = (debtPage - 1) * itemsPerPage;
    return patientsWithDebt.slice(startIndex, startIndex + itemsPerPage);
  }, [patientsWithDebt, debtPage]);

  useEffect(() => {
    if (debtPage > totalDebtPages) {
      setDebtPage(Math.max(1, totalDebtPages));
    }
  }, [patientsWithDebt.length, totalDebtPages, debtPage]);

  const stats = [
    { 
      label: selectedDate === todayStr ? 'CITAS HOY' : 'CITAS DEL DÍA', 
      value: filteredAppointments.length.toString(), 
      icon: 'calendar_month', 
      color: 'text-primary', 
      bg: 'bg-primary/10 dark:bg-primary/20',
      action: () => onViewChange && onViewChange(ViewMode.APPOINTMENTS)
    },
    { 
      label: 'PEDIDOS', 
      value: pendingInventoryCount.toString(), 
      icon: 'inventory', 
      color: 'text-amber-500', 
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      action: () => onViewChange && onViewChange(ViewMode.SERVICES)
    },
    { 
      label: 'PACIENTES', 
      value: patients.length.toString(), 
      icon: 'groups', 
      color: 'text-blue-500', 
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      action: () => onViewChange && onViewChange(ViewMode.PATIENTS_LIST)
    },
    { 
      label: selectedDate === todayStr ? 'INGRESOS HOY' : 'INGRESOS DEL DÍA', 
      isCurrency: true,
      penValue: `S/ ${selectedDayIncome.pen.toLocaleString('es-PE', {minimumFractionDigits: 2})}`,
      usdValue: `$${selectedDayIncome.usd.toLocaleString('en-US', {minimumFractionDigits: 2})}`, 
      icon: 'payments', 
      color: 'text-emerald-500', 
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      action: () => onViewChange && onViewChange(ViewMode.FINANCES)
    },
  ];

  const calendarGrid = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const grid = [];
    for (let i = 0; i < firstDay; i++) grid.push(null);
    for (let i = 1; i <= daysInMonth; i++) grid.push(new Date(year, month, i));
    return grid;
  }, [viewDate]);

  const handleDateSelect = (date: Date) => {
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    setSelectedDate(iso);
    setShowCalendar(false);
  };

  const handleWhatsAppClick = (e: React.MouseEvent, appt: Appointment) => {
    e.stopPropagation();
    sendAppointmentWhatsAppReminder(appt, patients);
  };

  return (
    <div className={`p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6 lg:space-y-8 animate-in fade-in duration-500 pb-20 scrollbar-hide relative ${isWC ? 'overflow-hidden rounded-[40px]' : ''}`}>
      {/* Decoraciones del Mundial de Fútbol (Junio & Julio) */}
      {isWC && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
          {/* Luces y resplandor de estadio verde césped */}
          <div className="absolute -top-40 -left-40 size-[500px] bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-[120px]"></div>
          <div className="absolute -bottom-40 -right-40 size-[500px] bg-green-500/5 dark:bg-green-500/10 rounded-full blur-[120px]"></div>
          
          {/* Balones de fútbol flotantes y saltarines */}
          <div className="absolute top-10 right-10 text-4xl opacity-[0.22] animate-bounce" style={{ animationDuration: '3.5s' }}>⚽</div>
          <div className="absolute top-1/3 left-4 text-3xl opacity-[0.15] animate-pulse" style={{ animationDuration: '4s' }}>⚽</div>
          <div className="absolute bottom-20 left-12 text-5xl opacity-[0.18] animate-bounce" style={{ animationDuration: '5s' }}>⚽</div>
          <div className="absolute bottom-1/3 right-8 text-3xl opacity-[0.15] animate-spin" style={{ animationDuration: '15s' }}>⚽</div>
          <div className="absolute top-1/4 right-1/4 text-2xl opacity-[0.12] animate-pulse" style={{ animationDuration: '2.5s' }}>⚽</div>
          <div className="absolute bottom-10 right-1/3 text-4xl opacity-[0.2] animate-bounce" style={{ animationDuration: '4.5s' }}>⚽</div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[28px] lg:text-[32px] font-black tracking-tight text-slate-900 dark:text-white leading-none uppercase">Panel Principal</h2>
          </div>
          <p className="text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.1em] text-[9px]">DRA. YANETT FALCON</p>
        </div>
        
        <div className="relative w-full sm:w-auto">
          <div 
            onDoubleClick={() => setShowCalendar(true)}
            className="bg-white dark:bg-slate-900 px-5 py-3 rounded-[24px] border-2 border-primary/20 dark:border-slate-800 shadow-sm flex items-center gap-3 transition-all hover:border-primary cursor-pointer group active:scale-95 select-none"
            title="Doble clic para calendario estético"
          >
            <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-2xl">event</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">FECHA SELECCIONADA</span>
              <span className="text-[13px] font-black text-slate-800 dark:text-white uppercase tracking-tight">
                {displayDate(selectedDate)}
              </span>
            </div>
            {selectedDate !== todayStr && (
              <button 
                onClick={(e) => { e.stopPropagation(); setSelectedDate(todayStr); }}
                className="size-7 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary rounded-full flex items-center justify-center transition-all ml-2"
                title="Volver a Hoy"
              >
                <span className="material-symbols-outlined text-lg">today</span>
              </button>
            )}
          </div>

          {showCalendar && (
            <div 
              ref={calendarRef}
              className={`absolute top-full right-0 mt-3 w-[320px] bg-white dark:bg-[#111827] rounded-[36px] shadow-[0_20px_70px_rgba(0,0,0,0.3)] border-4 z-[100] p-6 animate-in zoom-in-95 fade-in duration-200 ${
                isWC ? 'border-emerald-500 dark:border-emerald-600' : 'border-white dark:border-slate-800'
              }`}
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex flex-col">
                  <h4 className="text-lg font-black text-slate-900 dark:text-white capitalize tracking-tighter">
                    {viewDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                  </h4>
                  <span className={`text-[9px] font-black uppercase tracking-widest ${isWC ? 'text-emerald-500' : 'text-primary'}`}>
                    {isWC ? '⚽ Modo Mundialista' : 'Navegación Mensual'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="size-9 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-primary rounded-xl flex items-center justify-center transition-all"><span className="material-symbols-outlined text-lg">chevron_left</span></button>
                  <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="size-9 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-primary rounded-xl flex items-center justify-center transition-all"><span className="material-symbols-outlined text-lg">chevron_right</span></button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-2">
                {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
                  <div key={i} className="text-center text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase py-2">{d}</div>
                ))}
                {calendarGrid.map((date, idx) => {
                  if (!date) return <div key={idx} />;
                  const dateIso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                  const isSel = dateIso === selectedDate;
                  const isToday = dateIso === todayStr;
                  const hasAppts = appointments.filter(a => a.date === dateIso).length;

                  return (
                    <button
                      key={idx}
                      onClick={() => handleDateSelect(date)}
                      className={`relative aspect-square flex items-center justify-center rounded-[14px] text-xs font-black transition-all group ${
                        isSel 
                          ? isWC
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-110'
                            : 'bg-primary text-white shadow-lg shadow-primary/30 scale-110' 
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      } ${isToday && !isSel ? (isWC ? 'border-2 border-emerald-500/30 text-emerald-500' : 'border-2 border-primary/20 text-primary') : ''}`}
                    >
                      {date.getDate()}
                      {hasAppts > 0 && !isSel && (
                        <div className={`absolute bottom-1.5 size-1 rounded-full animate-pulse ${isWC ? 'bg-emerald-500' : 'bg-primary'}`}></div>
                      )}
                      {isToday && isWC && !isSel && (
                        <span className="absolute top-0.5 right-0.5 text-[7px]">⚽</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <button 
                onClick={() => { setSelectedDate(todayStr); setShowCalendar(false); setViewDate(new Date()); }}
                className={`w-full mt-4 py-3 rounded-2xl text-[10px] font-black transition-all uppercase tracking-widest ${
                  isWC 
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white'
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 hover:text-primary'
                }`}
              >
                Hoy • {displayDate(todayStr)}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
        {stats.map((stat, idx) => (
          <div 
            key={idx} 
            onClick={() => stat.action && stat.action()}
            className="bg-white dark:bg-slate-900 p-5 lg:p-6 rounded-[32px] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between min-h-[120px] lg:min-h-[150px] relative hover:shadow-xl transition-all cursor-pointer group overflow-hidden"
          >
            <div className="flex items-start justify-between relative z-10">
              <span className="text-slate-400 dark:text-slate-500 text-[8px] lg:text-[10px] font-black uppercase tracking-[0.15em]">{stat.label}</span>
              <div className={`size-8 lg:size-10 ${stat.bg} rounded-xl flex items-center justify-center border border-white/10 transition-transform group-hover:scale-110`}>
                <span className={`material-symbols-outlined ${stat.color} text-lg lg:text-2xl`}>{stat.icon}</span>
              </div>
            </div>
            
            <div className="relative z-10">
              {stat.isCurrency ? (
                <div className="mt-1 space-y-0.5">
                   <p className="text-[20px] lg:text-[28px] font-black text-slate-900 dark:text-white leading-none tracking-tighter truncate">{stat.penValue}</p>
                   <p className="text-[13px] lg:text-[17px] font-black text-emerald-500 leading-none tracking-tight opacity-90 truncate">{stat.usdValue}</p>
                </div>
              ) : (
                <p className="text-[32px] lg:text-[42px] font-black text-slate-900 dark:text-white leading-none tracking-tighter">{stat.value}</p>
              )}
            </div>
            <div className="absolute -bottom-10 -right-10 size-32 bg-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <div className="bg-white dark:bg-slate-900 rounded-[40px] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col min-h-[450px]">
            <div className="px-8 py-6 flex justify-between items-center bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="size-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                <h3 className="font-black text-lg lg:text-xl text-slate-900 dark:text-white tracking-tight uppercase">Saldos pendientes</h3>
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CONTROL DE CARTERA</span>
            </div>
            
            <div className="flex-1 flex flex-col p-4 bg-slate-50/30 dark:bg-slate-950/40 overflow-y-auto scrollbar-hide">
              {patientsWithDebt.length > 0 ? (
                <div className="w-full space-y-3">
                  {paginatedDebts.map((data) => (
                    <div 
                      key={data.patient.id} 
                      onClick={() => onSelectPatient(data.patient.id)}
                      className="flex items-center gap-4 p-4 bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg hover:border-primary/20 transition-all cursor-pointer group active:scale-[0.98]"
                    >
                      <div className="relative shrink-0">
                        <img 
                          src={data.patient.photo} 
                          alt={data.patient.name} 
                          className="size-11 lg:size-12 rounded-[14px] object-cover border border-slate-200 dark:border-slate-700 group-hover:scale-105 transition-transform" 
                        />
                        <div className="absolute -top-1 -right-1 size-3.5 bg-rose-500 border-2 border-white dark:border-slate-900 rounded-full"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[13px] lg:text-[14px] font-black text-slate-900 dark:text-white tracking-tight truncate uppercase leading-tight group-hover:text-primary transition-colors">{data.patient.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          {data.penDebt > 0 && (
                            <span className="text-[9px] lg:text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-50 dark:bg-rose-900/10 px-2 py-0.5 rounded-md truncate">
                              DEUDA S/ {data.penDebt.toLocaleString('es-PE', {minimumFractionDigits: 2})}
                            </span>
                          )}
                          {data.usdDebt > 0 && (
                            <span className="text-[9px] lg:text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-50 dark:bg-rose-900/10 px-2 py-0.5 rounded-md truncate">
                              DEUDA $ {data.usdDebt.toLocaleString('en-US', {minimumFractionDigits: 2})}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="hidden sm:flex items-center gap-2 shrink-0 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-700 group-hover:bg-primary/5 group-hover:border-primary/20 transition-all">
                        <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">VER FICHA</p>
                        <span className="material-symbols-outlined text-xs">chevron_right</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 py-24 opacity-20">
                  <span className="material-symbols-outlined text-[60px] font-light">verified_user</span>
                  <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-sm">CARTERA SIN DEUDAS</p>
                </div>
              )}
            </div>

            {patientsWithDebt.length > 0 && (
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Mostrando {patientsWithDebt.length === 0 ? 0 : (debtPage - 1) * itemsPerPage + 1}-{Math.min(patientsWithDebt.length, debtPage * itemsPerPage)} de {patientsWithDebt.length} cartera de deudores
                </p>
                
                {totalDebtPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDebtPage(prev => Math.max(1, prev - 1))}
                      disabled={debtPage === 1}
                      className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-0.5 font-bold text-[10px] uppercase tracking-wider"
                    >
                      <span className="material-symbols-outlined text-[14px]">chevron_left</span>
                      Atrás
                    </button>
                    
                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 px-2">
                      Pág. {debtPage} de {totalDebtPages}
                    </span>
                    
                    <button
                      type="button"
                      onClick={() => setDebtPage(prev => Math.min(totalDebtPages, prev + 1))}
                      disabled={debtPage === totalDebtPages}
                      className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-0.5 font-bold text-[10px] uppercase tracking-wider"
                    >
                      Siguiente
                      <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col min-h-[350px]">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-black text-xl text-slate-900 dark:text-white tracking-tight uppercase">
                {selectedDate === todayStr ? 'Citas de Hoy' : `Citas del ${displayDate(selectedDate)}`}
              </h3>
              <button 
                onClick={() => onViewChange && onViewChange(ViewMode.APPOINTMENTS)}
                className="text-[9px] font-black text-primary uppercase tracking-[0.2em] bg-primary/5 px-4 py-2 rounded-full border border-primary/10 hover:bg-primary hover:text-white transition-all"
              >VER TODAS</button>
            </div>
            
            <div className="space-y-4 overflow-y-auto scrollbar-hide pr-1 max-h-[320px]">
              {filteredAppointments.length > 0 ? (
                filteredAppointments.map((appt) => {
                  return (
                    <div 
                      key={appt.id} 
                      onClick={() => onSelectPatient(appt.paciente_id || '')}
                      className="p-5 rounded-[28px] bg-slate-50 dark:bg-slate-800/40 flex items-center gap-5 hover:shadow-xl transition-all cursor-pointer group active:scale-[0.98] border-2 border-transparent hover:border-primary/20"
                    >
                      <div className="text-center min-w-[55px] border-r border-black/5 dark:border-white/5 pr-4">
                        <p className="text-sm font-black text-primary leading-none">{appt.time}</p>
                        <p className="text-[8px] font-bold text-slate-500 uppercase mt-1">HORA</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[14px] font-black text-slate-900 dark:text-white truncate uppercase">{appt.patientName}</h4>
                        <p className="text-[10px] font-bold text-slate-500 truncate uppercase tracking-widest opacity-80 mt-0.5">{appt.procedure}</p>
                      </div>
                      <button 
                        onClick={(e) => handleWhatsAppClick(e, appt)}
                        className="size-10 rounded-xl flex items-center justify-center transition-all shrink-0 border shadow-sm bg-[#25D366]/10 text-[#25D366] border-[#25D366]/20 hover:bg-[#25D366] hover:text-white"
                        title="Enviar recordatorio por WhatsApp"
                      >
                        <WhatsAppIcon />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="py-16 flex flex-col items-center justify-center opacity-30 text-center grayscale">
                  <span className="material-symbols-outlined text-[60px] font-light">event_busy</span>
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] mt-4">Sin citas registradas</p>
                </div>
              )}
            </div>
          </div>

          <ActivityFeed onSelectPatientByName={(patientName) => {
            const found = patients.find(p => p.name.toUpperCase().includes(patientName.toUpperCase()) || (p.nombres && p.nombres.toUpperCase().includes(patientName.toUpperCase())));
            if (found) onSelectPatient(found.id);
          }} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
