
import React, { useMemo, useState } from 'react';
import { Patient } from '../types';
import * as XLSX from 'xlsx'; // Import XLSX library

interface Transaction {
  id: string;
  patientName: string;
  amount: number;
  currency: 'PEN' | 'USD';
  date: string;
  time?: string;
  description: string;
  type?: string;
  author?: string;
}

interface MonthlyTotal {
  year: number;
  month: number;
  label: string;
  totalPEN: number;
  totalUSD: number;
  transactions: Transaction[];
}

const displayDate = (dateStr: string | undefined) => {
  if (!dateStr) return '---';
  const rawDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
  const parts = rawDate.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
};

const FinanceReport: React.FC<{ patients: Patient[]; staffCount: number }> = ({ patients }) => {
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const monthlyData = useMemo(() => {
    const data: Record<string, MonthlyTotal> = {};
    
    patients.forEach(patient => {
      patient.advancePayments?.forEach(pay => {
        if (!pay.date) return;
        
        // REQUERIMIENTO: Solo registrar ingresos (Abonos)
        // Normalizamos el tipo para evitar errores de case-sensitivity (Abono vs abono)
        const type = (pay.type || 'Abono').toLowerCase();
        if (type !== 'abono') return; 

        // Manejo de fecha seguro para evitar saltos de zona horaria
        const dateParts = pay.date.split('-');
        if (dateParts.length < 3) return;
        
        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1; // 0-indexed
        const key = `${year}-${month}`;
        
        if (!data[key]) {
          data[key] = { 
            year, 
            month, 
            label: `${months[month]} ${year}`, 
            totalPEN: 0, 
            totalUSD: 0, 
            transactions: [] 
          };
        }
        
        const amount = pay.amount || 0;
        const currency = pay.currency || 'PEN';
        
        if (currency === 'USD') data[key].totalUSD += amount;
        else data[key].totalPEN += amount;

        data[key].transactions.push({
          id: pay.id,
          patientName: patient.name,
          amount: amount,
          currency: currency as any,
          date: pay.date,
          time: pay.time,
          description: pay.description || 'Ingreso / Pago',
          type: pay.type,
          author: pay.author || 'SISTEMA'
        });
      });
    });

    // Ordenar transacciones por fecha y hora descendente
    const result = Object.values(data).map(m => {
      m.transactions.sort((a, b) => {
        const dateA = `${a.date}T${a.time || '00:00'}`;
        const dateB = `${b.date}T${b.time || '00:00'}`;
        return dateB.localeCompare(dateA);
      });
      return m;
    });

    // Ordenar meses por cronología descendente
    return result.sort((a, b) => (a.year !== b.year ? b.year - a.year : b.month - a.month));
  }, [patients]);

  const activeMonth = useMemo(() => {
    if (monthlyData.length === 0) return null;
    if (selectedMonthKey) {
       return monthlyData.find(m => `${m.year}-${m.month}` === selectedMonthKey) || monthlyData[0];
    }
    return monthlyData[0];
  }, [monthlyData, selectedMonthKey]);

  const totals = useMemo(() => {
    return monthlyData.reduce((acc, curr) => ({
      pen: acc.pen + curr.totalPEN,
      usd: acc.usd + curr.totalUSD
    }), { pen: 0, usd: 0 });
  }, [monthlyData]);

  // Function to export current month's transactions to Excel
  const exportMonthlyExcel = () => {
    if (!activeMonth || activeMonth.transactions.length === 0) {
      alert("No hay transacciones para exportar en este mes.");
      return;
    }

    const dataToExport = activeMonth.transactions.map(t => ({
      "FECHA": displayDate(t.date),
      "HORA": t.time || '--:--',
      "PACIENTE": t.patientName,
      "AUTOR": t.author,
      "CONCEPTO": t.description,
      "MONTO": t.amount,
      "MONEDA": t.currency,
      "TIPO DE MOVIMIENTO": t.type || 'Abono', // Asegurar que siempre haya un tipo
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Reporte ${activeMonth.label}`);
    
    // Adjust column widths for better readability
    const wscols = [
      { wch: 12 }, // FECHA
      { wch: 8 },  // HORA
      { wch: 25 }, // PACIENTE
      { wch: 20 }, // AUTOR
      { wch: 40 }, // CONCEPTO
      { wch: 15 }, // MONTO
      { wch: 10 }, // MONEDA
      { wch: 20 }, // TIPO DE MOVIMIENTO
    ];
    worksheet['!cols'] = wscols;

    const fileName = `Reporte_Financiero_${activeMonth.label.replace(/\s/g, '_')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="p-4 lg:p-10 max-w-[1700px] mx-auto space-y-8 animate-in fade-in duration-700 pb-24 dark:bg-[#05080f]">
      
      {/* HEADER PREMIUM */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="size-12 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-inner">
               <span className="material-symbols-outlined text-3xl">account_balance_wallet</span>
            </div>
            <h2 className="text-[36px] lg:text-[46px] font-black tracking-tighter text-slate-900 dark:text-white leading-none uppercase">Caja y Finanzas</h2>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-black uppercase tracking-[0.3em] text-[10px] ml-1">REPORTES CONSOLIDADOS DE INGRESOS CLÍNICOS</p>
        </div>
        <div className="bg-white dark:bg-slate-900 px-6 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">update</span>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">Última actualización: <span className="text-slate-900 dark:text-white ml-2">{new Date().toLocaleDateString()}</span></p>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-[#3858fa] to-[#1e3a8a] text-white p-8 rounded-[40px] shadow-2xl shadow-blue-500/20 flex flex-col justify-between relative overflow-hidden group transition-all hover:scale-[1.02]">
          <div className="absolute -right-6 -bottom-6 opacity-10 group-hover:scale-110 transition-transform duration-700">
            <span className="material-symbols-outlined text-[140px]">payments</span>
          </div>
          <div className="relative z-10">
            <span className="text-[11px] font-black uppercase tracking-[0.25em] opacity-60">TOTAL INGRESOS (PEN)</span>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-[24px] font-black opacity-40">S/</span>
              <p className="text-[44px] font-black leading-tight tracking-tighter">{totals.pen.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-6 w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-white/40 w-full"></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#10b981] to-[#065f46] text-white p-8 rounded-[40px] shadow-2xl shadow-emerald-500/20 flex flex-col justify-between relative overflow-hidden group transition-all hover:scale-[1.02]">
          <div className="absolute -right-6 -bottom-6 opacity-10 group-hover:scale-110 transition-transform duration-700">
            <span className="material-symbols-outlined text-[140px]">monetization_on</span>
          </div>
          <div className="relative z-10">
            <span className="text-[11px] font-black uppercase tracking-[0.25em] opacity-60">TOTAL INGRESOS (USD)</span>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-[24px] font-black opacity-40">$</span>
              <p className="text-[44px] font-black leading-tight tracking-tighter">{totals.usd.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-6 w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-white/40 w-full"></div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-xl flex flex-col justify-between group relative overflow-hidden transition-all hover:shadow-2xl">
          <div className="absolute -right-4 -bottom-4 opacity-[0.03] dark:opacity-[0.05] group-hover:rotate-12 transition-transform">
             <span className="material-symbols-outlined text-[120px]">calendar_today</span>
          </div>
          <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em]">MESES CON ACTIVIDAD</span>
          <div className="mt-6 flex items-center gap-4">
            <div className="size-14 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-100 dark:border-slate-700">
              <span className="material-symbols-outlined text-primary text-2xl">event</span>
            </div>
            <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{monthlyData.length} <span className="text-lg font-bold text-slate-400">Ciclos</span></p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-xl flex flex-col justify-between group relative overflow-hidden transition-all hover:shadow-2xl">
          <div className="absolute -right-4 -bottom-4 opacity-[0.03] dark:opacity-[0.05] group-hover:rotate-12 transition-transform">
             <span className="material-symbols-outlined text-[120px]">sync_alt</span>
          </div>
          <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em]">TOTAL OPERACIONES</span>
          <div className="mt-6 flex items-center gap-4">
            <div className="size-14 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-100 dark:border-slate-700">
              <span className="material-symbols-outlined text-emerald-500 text-2xl">receipt_long</span>
            </div>
            <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">
              {monthlyData.reduce((acc, m) => acc + m.transactions.length, 0)} <span className="text-lg font-bold text-slate-400">Movs.</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        
        {/* LEFT: MONTHLY LIST */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[12px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">HISTORIAL POR MES</h3>
            <span className="material-symbols-outlined text-slate-300 dark:text-slate-700">sort</span>
          </div>
          <div className="bg-white/40 dark:bg-slate-900/40 rounded-[48px] p-2 border border-slate-100 dark:border-slate-800 shadow-inner flex flex-col max-h-[650px] overflow-y-auto scrollbar-hide">
            {monthlyData.length > 0 ? monthlyData.map((data, idx) => {
              const isSelected = (selectedMonthKey === `${data.year}-${data.month}` || (!selectedMonthKey && idx === 0));
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedMonthKey(`${data.year}-${data.month}`)}
                  className={`w-full text-left p-6 rounded-[36px] transition-all flex items-center justify-between group mb-2 last:mb-0 ${
                    isSelected ? 'bg-white dark:bg-slate-800 shadow-2xl shadow-blue-500/10 border border-blue-500/10' : 'hover:bg-white/60 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-5">
                    <div className={`size-12 rounded-2xl flex items-center justify-center font-black text-xs transition-all ${isSelected ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-slate-200'}`}>
                       {data.label.substring(0, 3).toUpperCase()}
                    </div>
                    <div>
                      <p className={`text-lg font-black tracking-tight ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>{data.label}</p>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{data.transactions.length} TRANSACCIONES</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-[16px] font-black leading-none ${isSelected ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>
                      S/ {data.totalPEN.toLocaleString()}
                    </p>
                    <p className="text-[10px] font-bold text-emerald-500 mt-1">${data.totalUSD.toLocaleString()}</p>
                  </div>
                </button>
              );
            }) : (
              <div className="py-20 text-center space-y-4 opacity-30">
                <span className="material-symbols-outlined text-6xl">query_stats</span>
                <p className="font-black uppercase tracking-[0.2em] text-xs">Sin actividad registrada</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: DETAIL TABLE */}
        <div className="col-span-12 lg:col-span-8 flex flex-col min-h-[650px]">
          <div className="bg-white dark:bg-slate-900 rounded-[56px] border border-slate-100 dark:border-slate-800 shadow-2xl shadow-slate-200/20 dark:shadow-none overflow-hidden flex flex-col flex-1 relative">
            {activeMonth ? (
              <>
                <div className="px-10 py-10 border-b border-slate-50 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-50/50 dark:bg-slate-900/50">
                  <div className="flex items-center gap-4">
                    <div className="size-14 bg-white dark:bg-slate-800 rounded-3xl flex items-center justify-center border border-slate-100 dark:border-slate-700 shadow-sm">
                       <span className="material-symbols-outlined text-primary text-3xl">insights</span>
                    </div>
                    <div>
                      <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">Reporte Mensual</h3>
                      <p className="text-[11px] font-black text-primary uppercase tracking-[0.2em] mt-1">{activeMonth.label}</p>
                    </div>
                  </div>
                  <div className="flex gap-4 w-full md:w-auto">
                    <div className="flex-1 md:flex-none bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/10 rounded-[28px] p-5 text-right min-w-[140px]">
                      <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">SUBTOTAL PEN</p>
                      <p className="text-2xl font-black text-[#3858fa]">S/ {activeMonth.totalPEN.toLocaleString()}</p>
                    </div>
                    <div className="flex-1 md:flex-none bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 rounded-[28px] p-5 text-right min-w-[140px]">
                      <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">SUBTOTAL USD</p>
                      <p className="text-2xl font-black text-[#10b981]">$ {activeMonth.totalUSD.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-100/50 dark:bg-slate-800/30 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                        <th className="px-10 py-5">FECHA / HORA</th>
                        <th className="px-10 py-5">PACIENTE / AUTOR</th>
                        <th className="px-10 py-5">CONCEPTO / DETALLE</th>
                        <th className="px-10 py-5 text-right">MONTO OPERACIÓN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                      {activeMonth.transactions.map((t, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors group">
                          <td className="px-10 py-6">
                            <div className="flex flex-col">
                              <span className="text-[14px] font-black text-slate-900 dark:text-white leading-tight">{displayDate(t.date)}</span>
                              <span className="text-[11px] font-black text-primary leading-tight">{t.time || '--:--'}</span>
                              <span className="text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-tighter mt-1">SESIÓN REGISTRADA</span>
                            </div>
                          </td>
                          <td className="px-10 py-6">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <div className="size-2 bg-primary rounded-full"></div>
                                <span className="text-[15px] font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight">{t.patientName}</span>
                              </div>
                              <div className="flex items-center gap-1.5 ml-4">
                                <span className="material-symbols-outlined text-[14px] text-slate-400">person_check</span>
                                <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">AUTOR: {t.author}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-10 py-6">
                            <p className="text-[12px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight italic line-clamp-1">"{t.description}"</p>
                          </td>
                          <td className="px-10 py-6 text-right">
                            <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-2xl font-black text-[18px] shadow-sm border ${
                              (t.type || '').toLowerCase() === 'cargo' 
                              ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' 
                              : (t.currency === 'USD' ? 'bg-emerald-500/10 text-[#10b981] border-emerald-500/20' : 'bg-primary/10 text-primary border-primary/20')
                            }`}>
                              {(t.type || '').toLowerCase() === 'cargo' ? '-' : '+'}
                              {t.currency === 'USD' ? '$' : 'S/'}{t.amount.toLocaleString()}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {activeMonth.transactions.length === 0 && (
                    <div className="py-20 text-center opacity-20 italic">No hay transacciones para este periodo</div>
                  )}
                </div>
                
                <div className="p-8 bg-slate-50/30 dark:bg-slate-800/20 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center">
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">GENERADO POR SISTEMA SM DENTAL</p>
                  <button 
                    onClick={exportMonthlyExcel}
                    className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">download</span> EXPORTAR EXCEL
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-20 opacity-20 text-center">
                <span className="material-symbols-outlined text-[120px] font-light" style={{ fontVariationSettings: "'wght' 100" }}>analytics</span>
                <p className="font-black uppercase tracking-[0.3em] mt-8 text-sm">Seleccione un mes para visualizar el reporte detallado</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinanceReport;
