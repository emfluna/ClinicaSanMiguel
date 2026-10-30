
import React, { useState, useEffect } from 'react';
import { Patient } from '../types';
import { INITIAL_TEETH_IDS } from '../constants';

interface NewPatientModalProps {
  patient?: Patient;
  suggestedId?: string;
  onClose: () => void;
  onSubmit: (patient: Patient) => Promise<void>; // onSubmit ahora devuelve una promesa
}

const countries = [
  { code: '+51', name: 'Perú', flag: '🇵🇪' },
  { code: '+1', name: 'EE.UU.', flag: '🇺🇸' },
  { code: '+34', name: 'España', flag: '🇪🇸' },
  { code: '+52', name: 'México', flag: '🇲🇽' },
];

// Helper para convertir DD/MM/AAAA a YYYY-MM-DD
const formatDateToISO = (dateStr: string) => {
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return dateStr;
};

// Helper para convertir YYYY-MM-DD a DD/MM/AAAA
const formatDateToDisplay = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  return dateStr;
};

const NewPatientModal: React.FC<NewPatientModalProps> = ({ patient, suggestedId, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [birthDateDisplay, setBirthDateDisplay] = useState(''); // Estado para DD/MM/AAAA
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+51');
  const [address, setAddress] = useState('');
  const [dni, setDni] = useState('');
  const [manualId, setManualId] = useState(suggestedId || '');
  const [isSubmitting, setIsSubmitting] = useState(false); // Nuevo estado de carga del botón

  useEffect(() => {
    if (patient) {
      setName(patient.name);
      setBirthDateDisplay(formatDateToDisplay(patient.fecha_nacimiento || ''));
      setGender(patient.gender);
      setEmail(patient.email || '');
      setDni(patient.dni || '');
      setAddress(patient.address || '');
      setManualId(patient.id);
      
      const savedPhone = patient.phone || '';
      const matchedCountry = countries.find(c => savedPhone.startsWith(c.code));
      if (matchedCountry) {
        setCountryCode(matchedCountry.code);
        setPhone(savedPhone.replace(matchedCountry.code, '').trim());
      } else {
        setPhone(savedPhone);
      }
    }
  }, [patient]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, ''); // Solo números
    if (val.length > 8) val = val.slice(0, 8);
    
    // Auto-formateo DD/MM/AAAA
    let formatted = val;
    if (val.length > 2 && val.length <= 4) {
      formatted = `${val.slice(0, 2)}/${val.slice(2)}`;
    } else if (val.length > 4) {
      formatted = `${val.slice(0, 2)}/${val.slice(2, 4)}/${val.slice(4)}`;
    }
    setBirthDateDisplay(formatted);
  };

  const calculateAge = (dobISO: string) => {
    if (!dobISO || dobISO.length < 10) return 0;
    const birth = new Date(dobISO);
    if (isNaN(birth.getTime())) return 0;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true); // Deshabilitar botón
    
    // Validación mínima obligatoria
    if (!name.trim()) {
      alert("Por favor complete el nombre del paciente.");
      setIsSubmitting(false);
      return;
    }

    // Si el usuario intentó escribir una fecha pero no la terminó
    if (birthDateDisplay.length > 0 && birthDateDisplay.length < 10) {
      alert("La fecha de nacimiento debe estar completa (DD/MM/AAAA) o quedar vacía para continuar.");
      setIsSubmitting(false);
      return;
    }

    const isoDate = birthDateDisplay.length === 10 ? formatDateToISO(birthDateDisplay) : '';
    const calculatedAge = isoDate ? calculateAge(isoDate) : (patient?.age || 0);
    const fullPhone = phone.trim() ? `${countryCode} ${phone.trim()}` : '';

    const finalPatient: Patient = {
      id: manualId || Math.random().toString(36).substr(2, 9),
      name: name.trim(),
      fecha_nacimiento: isoDate,
      age: calculatedAge,
      gender,
      email: email.trim(),
      phone: fullPhone,
      address: address.trim(),
      dni: dni.trim(),
      photo: patient?.photo || `https://picsum.photos/seed/${name.replace(/\s/g, '')}/200`,
      alerts: patient?.alerts || [],
      medicalFlags: patient?.medicalFlags || {
        heartProblems: false,
        coagulation: false,
        asthma: false,
        hypertension: false,
        diabetes: false,
        epilepsy: false,
        pregnancy: false,
        allergies: false,
        anemia: false,
        others: ''
      },
      teeth: patient?.teeth || INITIAL_TEETH_IDS.map(id => ({ id, fdi: id.toString(), status: 'healthy' })),
      treatmentPlan: patient?.treatmentPlan || [],
      clinicalNotes: patient?.clinicalNotes || [],
      medicalHistory: patient?.medicalHistory || [],
      images: patient?.images || [],
      advancePayments: patient?.advancePayments || []
    };

    try {
      await onSubmit(finalPatient);
      // El modal se cerrará desde el App.tsx en caso de éxito, reseteando este estado implícitamente
    } catch (error) {
      // Si onSubmit lanza un error, volvemos a habilitar el botón
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-[340px] rounded-[36px] shadow-2xl overflow-hidden animate-in zoom-in duration-300 border-[6px] border-white dark:border-slate-800 transition-colors">
        <div className="px-5 py-4 flex justify-between items-start">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight leading-none">
              {patient ? 'Editar Paciente' : 'Registrar Paciente'}
            </h3>
            <p className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mt-1.5">SM DENTAL SYSTEM</p>
          </div>
          <button onClick={onClose} className="size-8 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-400 hover:text-red-500 transition-all flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-4 overflow-y-auto max-h-[75vh] scrollbar-hide">
          {/* NOMBRE COMPLETO */}
          <div className="space-y-1.5">
            <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] ml-1">NOMBRE COMPLETO</label>
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary text-lg">person</span>
              <input 
                type="text" 
                required
                placeholder="Nombre y Apellidos..."
                className="w-full h-10 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-xl pl-10 pr-4 text-[11px] font-bold text-slate-800 placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          {/* DNI */}
          <div className="space-y-1.5">
            <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] ml-1">DNI / DOCUMENTO</label>
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 text-lg">badge</span>
              <input 
                type="text" 
                placeholder="Nº Documento..."
                className="w-full h-10 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-xl pl-10 pr-4 text-[11px] font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
                value={dni}
                onChange={(e) => setDni(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
             {/* GENERO */}
             <div className="space-y-1.5">
              <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] ml-1">GÉNERO</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 text-lg">wc</span>
                <select 
                  className="w-full h-10 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-xl pl-9 pr-2 text-[10px] font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 transition-all appearance-none shadow-inner"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                >
                  <option value="Male">Masculino</option>
                  <option value="Female">Femenino</option>
                  <option value="Other">Otro</option>
                </select>
              </div>
            </div>
             {/* FECHA DE NACIMIENTO */}
            <div className="space-y-1.5">
              <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] ml-1">NACIMIENTO</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary text-lg">cake</span>
                <input 
                  type="text" 
                  placeholder="DD/MM/AAAA"
                  className="w-full h-10 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-xl pl-9 pr-2 text-[10px] font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
                  value={birthDateDisplay}
                  onChange={handleDateChange}
                />
              </div>
            </div>
          </div>

          {/* CORREO */}
          <div className="space-y-1.5">
            <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] ml-1">CORREO ELECTRÓNICO</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500 text-lg">mail</span>
              <input 
                type="email" 
                placeholder="ejemplo@correo.com"
                className="w-full h-10 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-xl pl-10 pr-4 text-[11px] font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* TELEFONO */}
          <div className="space-y-1.5">
            <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] ml-1">TELÉFONO / CELULAR</label>
            <div className="flex h-10 gap-2">
              <div className="relative min-w-[70px]">
                <select
                  className="w-full h-full bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-xl pl-2 pr-6 text-[10px] font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 transition-all appearance-none shadow-inner"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                >
                  {countries.map(c => (
                    <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 pointer-events-none text-xs">expand_more</span>
              </div>
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 text-lg">phone</span>
                <input 
                  type="tel" 
                  placeholder="912 345 678"
                  className="w-full h-full bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-xl pl-10 pr-4 text-[11px] font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* DIRECCION */}
          <div className="space-y-1.5">
            <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] ml-1">DIRECCIÓN</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-amber-500 text-lg">location_on</span>
              <input 
                type="text" 
                placeholder="Calle, Numero, Ciudad..."
                className="w-full h-10 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-xl pl-10 pr-4 text-[11px] font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </div>

          {/* ACCIONES */}
          <div className="pt-2 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              disabled={isSubmitting} // Deshabilitar si se está enviando
              className="flex-1 h-10 border-2 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-black rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all uppercase tracking-widest text-[8px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              CANCELAR
            </button>
            <button 
              type="submit"
              disabled={isSubmitting} // Deshabilitar si se está enviando
              className="flex-1 h-10 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/20 hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest text-[8px] flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined text-lg animate-spin">sync</span>
                  {patient ? 'GUARDANDO...' : 'REGISTRANDO...'}
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">{patient ? 'save' : 'person_add'}</span>
                  {patient ? 'GUARDAR' : 'REGISTRAR'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewPatientModal;
