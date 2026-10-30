
import React from 'react';
import { Patient } from '../types';

interface PatientPortalProps {
  patient: Patient;
}

const PatientPortal: React.FC<PatientPortalProps> = ({ patient }) => {
  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto scrollbar-hide">
      <div className="p-8 max-w-5xl mx-auto w-full space-y-8">
        <div>
          <h3 className="text-3xl font-black tracking-tight text-slate-900">Bienvenido(a) de nuevo, {patient.name.split(' ')[0]}</h3>
          <p className="text-slate-500 font-medium mt-1">Gestiona tu salud dental, próximas citas y planes de tratamiento desde aquí.</p>
        </div>

        <section>
          <h4 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-800">
            <span className="material-symbols-outlined text-primary">event</span> Mi Próxima Cita
          </h4>
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 flex flex-col md:flex-row">
            <div className="md:w-1/3 h-48 md:h-auto bg-cover bg-center" style={{ backgroundImage: 'url(https://picsum.photos/seed/clinic/600/400)' }}></div>
            <div className="p-8 flex-1 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <h5 className="text-2xl font-black text-primary">Terapia de Conducto</h5>
                  <p className="text-slate-500 font-bold text-sm uppercase tracking-widest mt-1">Dra. Yanett Falcon</p>
                </div>
                <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/10">Confirmada</div>
              </div>
              <div className="mt-8 flex flex-wrap gap-8">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400">calendar_today</span>
                  <span className="text-sm font-bold text-slate-700">24 de Junio, 2024</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400">schedule</span>
                  <span className="text-sm font-bold text-slate-700">10:00 AM (60 min)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400">location_on</span>
                  <span className="text-sm font-bold text-slate-700">Clínica Principal, Suite 202</span>
                </div>
              </div>
              <div className="mt-10 flex gap-4">
                <button className="bg-primary text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-blue-700 transition-all">Agregar al Calendario</button>
                <button className="bg-slate-100 text-slate-600 px-8 py-3 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">Reprogramar</button>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <section className="lg:col-span-2 space-y-4">
            <h4 className="text-xl font-bold flex items-center gap-2 text-slate-800">
              <span className="material-symbols-outlined text-primary">assignment</span> Mi Plan de Tratamiento
            </h4>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Procedimiento</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {patient.treatmentPlan.length > 0 ? (
                    patient.treatmentPlan.map((t, idx) => (
                      <tr key={idx}>
                        <td className="px-6 py-5">
                          <p className="font-bold text-slate-900">{t.procedure}</p>
                          <p className="text-xs text-slate-400 mt-1 uppercase tracking-tight font-bold">{t.status === 'pending' ? 'Pendiente' : t.status === 'in-progress' ? 'En Progreso' : t.status}</p>
                        </td>
                        <td className="px-6 py-5 text-sm font-bold text-slate-900 text-right">${t.estimate.toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="px-6 py-8 text-center text-slate-400 italic">No hay planes de tratamiento activos.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="p-8 bg-slate-50/50 space-y-4 border-t border-slate-100">
                <div className="flex justify-between items-baseline pt-4 border-t border-slate-200">
                  <span className="text-base font-bold text-slate-800">Total del Tratamiento</span>
                  <span className="text-3xl font-black text-primary">${patient.treatmentPlan.reduce((a,c)=>a+c.estimate, 0).toFixed(2)}</span>
                </div>
                <div className="mt-6 flex gap-3">
                  <button className="flex-1 bg-primary/10 text-primary py-3 rounded-xl font-bold text-sm hover:bg-primary/20 transition-all">Opciones de Financiamiento</button>
                  <button className="flex-1 bg-primary text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-primary/20">Realizar Pago</button>
                </div>
              </div>
            </div>
          </section>

          <aside className="space-y-8">
            <section className="space-y-4">
              <h4 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                <span className="material-symbols-outlined text-orange-500">pending_actions</span> Consentimientos
              </h4>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100">
                <div className="flex items-start gap-4">
                  <div className="bg-orange-100 p-2 rounded-xl text-orange-600"><span className="material-symbols-outlined">edit_square</span></div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900">Formulario de Consentimiento</p>
                    <p className="text-xs text-slate-500 mt-1">Por favor revise y firme antes de su próxima visita.</p>
                    <button className="mt-4 w-full bg-primary text-white py-2 rounded-lg font-bold text-xs">Firma Electrónica</button>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h4 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                <span className="material-symbols-outlined text-primary">forum</span> Mensajes de la Clínica
              </h4>
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200">
                <div className="p-4 border-b border-slate-50 hover:bg-slate-50 cursor-pointer">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">San Miguel Dental</span>
                    <span className="text-[10px] text-slate-400 font-bold">hace 2h</span>
                  </div>
                  <p className="text-xs font-bold text-slate-900 truncate">Notas previas a su cita</p>
                  <p className="text-[10px] text-slate-500 line-clamp-2 mt-1">Hola {patient.name.split(' ')[0]}, no olvide evitar comer 2 horas antes de su procedimiento...</p>
                </div>
                <div className="p-4 text-center">
                  <a href="#" className="text-xs font-bold text-primary hover:underline transition-all">Ver todos los mensajes</a>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default PatientPortal;
