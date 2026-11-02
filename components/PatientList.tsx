
import React, { useState, useMemo, useEffect } from 'react';
import { Patient } from '../types';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { downloadPatientZip as _downloadPatientZip } from '../utils/patientExportUtils'; // Import utility

interface PatientListProps {
  patients: Patient[];
  onSelectPatient: (id: string) => void;
  onDeletePatient: (id: string) => void;
  onEditPatient: (patient: Patient) => void;
  onNewPatient: () => void;
  shortcutIds?: string[];
  onToggleShortcut?: (id: string) => void;
  // Props lifted from App.tsx
  patientsNeedingBackup: Set<string>;
  handleDownloadAllNeededZips: () => void;
  isBulkDownloading: boolean;
  onBackupSuccess?: () => void; // Callback to refresh backup status in parent
  onOpenBackupPrompt?: () => void; // Abre el recuadro de confirmación de nuevos pacientes
}

const PatientList: React.FC<PatientListProps> = ({ 
  patients, 
  onSelectPatient, 
  onDeletePatient, 
  onEditPatient, 
  onNewPatient,
  shortcutIds = [],
  onToggleShortcut,
  patientsNeedingBackup, // Received as prop
  handleDownloadAllNeededZips, // Received as prop
  isBulkDownloading, // Received as prop
  onBackupSuccess,
  onOpenBackupPrompt,
}) => {
  const [filter, setFilter] = useState('');
  const [zippingId, setZippingId] = useState<string | null>(null);
  
  // Estados para protección por clave unificada cambiada a "1717"
  const [authAction, setAuthAction] = useState<{ type: 'edit' | 'delete' | 'export_general' | 'backup', patient?: Patient } | null>(null);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState(false);
  
  const [localStorageChangeTrigger, setLocalStorageChangeTrigger] = useState(0);

  // NUEVOS ESTADOS PARA EL MODAL DE CONFIRMACIÓN
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [patientToConfirmDelete, setPatientToConfirmDelete] = useState<Patient | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filtered = useMemo(() => {
    return patients.filter(p => 
      p.name.toLowerCase().includes(filter.toLowerCase()) || 
      p.id.includes(filter) ||
      (p.phone && p.phone.includes(filter))
    );
  }, [patients, filter]);

  // Reset page to 1 whenever search text changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;

  const paginatedPatients = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  }, [filtered, currentPage]);

  const handleAuthorize = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (authPassword === '1717') {
      if (authAction) {
        if (authAction.type === 'delete' && authAction.patient) {
          onDeletePatient(authAction.patient.id);
        } else if (authAction.type === 'export_general') {
          exportToExcel();
        } else if (authAction.type === 'backup') {
          handleDownloadAllNeededZips();
        }
        setAuthAction(null);
        setAuthPassword('');
        setAuthError(false);
      }
    } else {
      setAuthError(true);
      setTimeout(() => setAuthError(false), 2000);
    }
  };

  const exportToExcel = () => {
    const dataToExport = patients.map(p => {
      // Formatear Antecedentes Médicos
      const medicalConditions = Object.entries(p.medicalFlags || {})
        .filter(([key, value]) => value === true && key !== 'others')
        .map(([key]) => {
          switch(key) {
            case 'heartProblems': return 'Problemas Cardíacos';
            case 'coagulation': return 'COAGULACIÓN';
            case 'asthma': return 'ASMA';
            case 'hypertension': return 'HIPERTENSIÓN';
            case 'diabetes': return 'DIABETES';
            case 'epilepsy': return 'EPILEPSIA';
            case 'pregnancy': return 'EMBARAZO';
            case 'allergies': return 'ALERGIAS';
            case 'anemia': return 'ANEMIA';
            default: return key;
          }
        });
      
      if (p.medicalFlags?.others) {
        medicalConditions.push(`Otros: ${p.medicalFlags.others}`);
      }
      
      const antecedentesStr = medicalConditions.length > 0 ? medicalConditions.join(', ') : 'Ninguno';

      // Formatear Historial Clínico (Notas)
      const historialStr = p.clinicalNotes 
        ? p.clinicalNotes.map(n => `[${n.date}]: ${n.text}`).join(' | ') 
        : 'Sin registros';

      // Mapeo exacto de columnas solicitado
      return {
        "Nombre": p.nombres || p.name.split(' ')[0] || '',
        "Apellido": p.apellidos || p.name.split(' ').slice(1).join(' ') || '',
        "DNI": p.dni || '',
        "Fecha de Nacimiento": p.fecha_nacimiento || '',
        "Género": p.gender === 'Male' ? 'Masculino' : p.gender === 'Female' ? 'Femenino' : 'Otro',
        "Teléfono": p.phone || '',
        "Email": p.email || '',
        "Dirección": p.address || '',
        "Antecedentes Médicos": antecedentesStr,
        "Historial Clínico": historialStr
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Lista Pacientes");
    
    // Ajustar ancho de columnas (opcional, para mejor visualización)
    const wscols = [
      {wch: 15}, // Nombre
      {wch: 20}, // Apellido
      {wch: 12}, // DNI
      {wch: 15}, // Fecha Nac
      {wch: 10}, // Género
      {wch: 15}, // Teléfono
      {wch: 25}, // Email
      {wch: 30}, // Dirección
      {wch: 30}, // Antecedentes
      {wch: 50}, // Historial
    ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, "Pacientes_Clinica_SM.xlsx");
  };

  const handleDownloadPatientZip = async (patient: Patient) => {
    setZippingId(patient.id);
    const success = await _downloadPatientZip(patient); // Use the utility function
    if (!success) {
      alert("Error al generar el archivo comprimido.");
    } else {
      // Trigger parent update so the green frame disappears
      if (onBackupSuccess) onBackupSuccess();
    }
    setZippingId(null);
  };

  // NUEVAS FUNCIONES PARA EL MODAL DE CONFIRMACIÓN
  const handleInitiateDelete = (patient: Patient) => {
    setPatientToConfirmDelete(patient);
    setShowConfirmDeleteModal(true);
  };

  const handleConfirmDeletion = () => {
    if (patientToConfirmDelete) {
      setShowConfirmDeleteModal(false);
      setAuthAction({ type: 'delete', patient: patientToConfirmDelete }); // Procede al modal de clave
      setAuthPassword(''); // Limpiar clave anterior
      setAuthError(false); // Resetear error
    }
  };

  const handleCancelDeletion = () => {
    setShowConfirmDeleteModal(false);
    setPatientToConfirmDelete(null);
  };


  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4 animate-in fade-in duration-500 dark:bg-slate-950 min-h-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-[28px] font-black tracking-tighter text-slate-900 dark:text-white leading-tight">Base de Pacientes</h2>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => {
              if (onOpenBackupPrompt) {
                onOpenBackupPrompt();
              } else {
                handleDownloadAllNeededZips();
              }
            }}
            disabled={isBulkDownloading || patientsNeedingBackup.size === 0}
            className={`px-4 h-10 rounded-[14px] text-white text-[10px] font-black shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 shrink-0 ${
              patientsNeedingBackup.size > 0 
              ? 'bg-slate-700 shadow-slate-700/30 hover:bg-slate-800 cursor-pointer'
              : 'bg-slate-800/80 shadow-slate-800/30 opacity-60 cursor-not-allowed'
            }`}
            title={`Descargar información de nuevos pacientes (${patientsNeedingBackup.size})`}
          >
            {isBulkDownloading ? (
              <span className="material-symbols-outlined text-[18px] animate-spin text-purple-400">sync</span>
            ) : (
              <span className="material-symbols-outlined text-[18px] text-purple-400">cloud_download</span>
            )}
            RESPALDO ({patientsNeedingBackup.size})
          </button>
          <button 
            onClick={() => {
              setAuthAction({ type: 'export_general' });
              setAuthPassword('');
              setAuthError(false);
            }}
            className="bg-emerald-600 text-white size-10 rounded-[14px] font-black shadow-lg shadow-emerald-600/30 flex items-center justify-center hover:bg-emerald-700 transition-all active:scale-95 shrink-0"
            title="Exportar Excel"
          >
            <span className="material-symbols-outlined text-[20px]">download</span> 
          </button>
          <button 
            onClick={onNewPatient}
            className="flex bg-primary text-white px-5 py-2.5 rounded-[14px] font-black text-[11px] shadow-lg shadow-primary/30 items-center gap-2 hover:bg-blue-700 transition-all uppercase tracking-wider active:scale-95 shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span> 
            NUEVO PACIENTE
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col transition-colors">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center gap-4">
          <div className="relative max-w-md w-full">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-primary text-[18px]">search</span>
            <input 
              type="text" 
              placeholder="Buscar pacientes por nombre, ID o teléfono..."
              className="w-full h-10 bg-slate-50 dark:bg-slate-800 border-none rounded-xl pl-10 pr-4 text-[11px] font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-primary/20 transition-all"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.12em] border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                <th className="px-4 py-3">PACIENTE</th>
                <th className="px-4 py-3">CONTACTO</th>
                <th className="px-4 py-3 text-right">ACCIONES Y EXPORTACIÓN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {paginatedPatients.map((patient) => {
                const isShortcut = shortcutIds.includes(patient.id);
                const isZipping = zippingId === patient.id;
                const needsBackup = patientsNeedingBackup.has(patient.id); // Check the memoized set

                return (
                  <tr 
                    key={patient.id} 
                    className={`
                      hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group
                      ${needsBackup ? 'bg-emerald-700/20 dark:bg-emerald-700/30' : ''}
                    `}
                  >
                    <td 
                      className="px-4 py-2 cursor-pointer group/cell"
                      onClick={() => onSelectPatient(patient.id)}
                    >
                      <div className="flex items-center gap-3">
                        <img src={patient.photo} className="size-9 rounded-lg object-cover border-2 border-white dark:border-slate-700 shadow-sm" alt={patient.name} />
                        <div>
                          <p className="text-[13px] font-black text-slate-900 dark:text-white group-hover/cell:text-primary transition-colors leading-tight">{patient.name}</p>
                          <p className="text-[8px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest mt-0.5">
                            {patient.age}A • {patient.gender === 'Male' ? 'MASC' : 'FEM'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 leading-tight">
                          <span className="material-symbols-outlined text-[14px] text-emerald-500">phone</span>
                          {patient.phone || 'N/A'}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5 lowercase leading-tight">
                          <span className="material-symbols-outlined text-[14px] text-blue-400">mail</span>
                          {patient.email || 'N/A'}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadPatientZip(patient);
                          }}
                          disabled={isZipping}
                          className="bg-indigo-600 text-white size-7 rounded-lg hover:bg-indigo-700 transition-all border border-indigo-500/20 shadow-md flex items-center justify-center disabled:opacity-50 disabled:cursor-wait"
                          title="Descargar ZIP con Excel y Fotos"
                        >
                          {isZipping ? (
                            <span className="material-symbols-outlined text-[12px] animate-spin">sync</span>
                          ) : (
                            <span className="material-symbols-outlined text-[12px]">folder_zip</span>
                          )}
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPatient(patient.id);
                          }}
                          className="bg-primary/10 dark:bg-primary/20 text-primary px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all border border-primary/10"
                        >
                          VER
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            // Edición directa sin contraseña
                            onEditPatient(patient);
                          }}
                          className="size-7 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg hover:bg-primary hover:text-white transition-all flex items-center justify-center border border-slate-200/50 dark:border-slate-700"
                          title="Editar"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button 
                          onClick={(e) => { 
                            e.preventDefault();
                            e.stopPropagation(); 
                            handleInitiateDelete(patient); // NUEVO: Abrir modal de confirmación
                          }}
                          className="size-7 bg-red-50 dark:bg-red-900/10 text-red-500 dark:text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-all flex items-center justify-center border border-red-100/50 dark:border-red-900/30"
                          title="Eliminar (Protegido)"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-16 text-center text-slate-300 dark:text-slate-700 font-black uppercase tracking-widest italic">
                    <span className="material-symbols-outlined text-[40px] block mb-2 opacity-20 text-primary">person_search</span>
                    Sin registros
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Mostrando {filtered.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-{Math.min(filtered.length, currentPage * itemsPerPage)} de {filtered.length} registros
          </p>
          
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-0.5 font-bold text-[10px] uppercase tracking-wider"
              >
                <span className="material-symbols-outlined text-[14px]">chevron_left</span>
                Atrás
              </button>
              
              <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 px-2">
                Pág. {currentPage} de {totalPages}
              </span>
              
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-0.5 font-bold text-[10px] uppercase tracking-wider"
              >
                Siguiente
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE AUTORIZACIÓN PARA EDICIÓN / BORRADO (CLAVE: 1717) */}
      {authAction && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden border-4 border-white dark:border-slate-800 animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-center flex flex-col items-center">
              <div className="size-12 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-2xl flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-2xl">lock_person</span>
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight leading-none uppercase">
                {authAction.type === 'export_general' ? 'EXPORTAR DATOS' : authAction.type === 'backup' ? 'DESCARGAR RESPALDO' : 'ELIMINAR REGISTRO'}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">
                Clave de Seguridad (1717)
              </p>
              <form onSubmit={handleAuthorize}>
                <input 
                  type="password" 
                  autoFocus 
                  className={`w-full h-12 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-center text-lg font-black tracking-[0.4em] dark:text-white mb-4 ${authError ? 'ring-2 ring-red-500 bg-red-50 dark:bg-red-900/10' : 'focus:ring-2 focus:ring-primary/20'}`} 
                  placeholder="••••" 
                  value={authPassword} 
                  onChange={e=>setAuthPassword(e.target.value)}
                />
                <div className="flex gap-2">
                   <button type="button" onClick={() => { setAuthAction(null); setAuthPassword(''); }} className="flex-1 h-10 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-black rounded-lg text-[9px] uppercase">CANCELAR</button>
                   <button type="submit" className={`flex-1 h-10 text-white font-black rounded-lg text-[9px] uppercase shadow-lg ${authAction.type === 'delete' ? 'bg-red-600 shadow-red-500/20' : authAction.type === 'backup' ? 'bg-indigo-600 shadow-indigo-500/20' : 'bg-emerald-600 shadow-emerald-500/20'}`}>CONFIRMAR</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* NUEVO MODAL DE CONFIRMACIÓN */}
      {showConfirmDeleteModal && patientToConfirmDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden border-4 border-white dark:border-slate-800 animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-center flex flex-col items-center">
              <div className="size-12 bg-amber-50 dark:bg-amber-900/20 text-amber-500 dark:text-amber-400 rounded-2xl flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-2xl">warning</span>
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight leading-none uppercase">
                ¡ATENCIÓN!
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 text-center leading-relaxed">
                Si borras el registro de <span className="font-black text-primary">{patientToConfirmDelete.name}</span> no podrás recuperarlo, ¿estás segura(o) de hacerlo?
              </p>
              <div className="flex gap-2">
                 <button type="button" onClick={handleCancelDeletion} className="flex-1 h-10 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-black rounded-lg text-[9px] uppercase">No, Cancelar</button>
                 <button type="button" onClick={handleConfirmDeletion} className="flex-1 h-10 bg-red-600 shadow-red-500/20 text-white font-black rounded-lg text-[9px] uppercase shadow-lg">Sí, Eliminar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientList;
