import { Patient } from '../types';

export interface AppointmentWhatsAppSource {
  id?: string;
  paciente_id?: string;
  patientName: string;
  procedure: string;
  time: string;
  date?: string;
}

export const formatPhoneForWhatsApp = (rawPhone?: string | null): string => {
  if (!rawPhone) return '';
  const digits = String(rawPhone).replace(/\D/g, '');
  if (!digits) return '';

  // Si tiene 9 dígitos (formato estándar móvil Perú 9XXXXXXXX), agregamos código país 51
  if (digits.length === 9) {
    return `51${digits}`;
  }

  // Si tiene 11 dígitos y empieza con 51 (ej. 519XXXXXXXX)
  if (digits.length === 11 && digits.startsWith('51')) {
    return digits;
  }

  // Si empieza con 0051 (ej. 00519XXXXXXXX)
  if (digits.startsWith('0051')) {
    return digits.slice(2);
  }

  // Si ya tiene más de 9 dígitos (ej. código internacional de otro país)
  if (digits.length > 9) {
    return digits;
  }

  // Por defecto anteponer 51 si tiene dígitos
  return `51${digits}`;
};

const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

export const findPatientForAppointment = (
  appt: { paciente_id?: string; patientName?: string },
  patients: Patient[]
): Patient | undefined => {
  if (!patients || patients.length === 0) return undefined;

  // 1. Búsqueda directa por ID
  if (appt.paciente_id) {
    const foundById = patients.find(p => p.id === appt.paciente_id);
    if (foundById) return foundById;
  }

  if (!appt.patientName) return undefined;

  const targetName = normalizeText(appt.patientName);
  if (!targetName) return undefined;

  // 2. Búsqueda exacta por nombre completo o campos
  const exactMatch = patients.find(p => {
    const pName = normalizeText(p.name || '');
    const pFullName = normalizeText(`${p.nombres || ''} ${p.apellidos || ''}`);
    return pName === targetName || pFullName === targetName;
  });
  if (exactMatch) return exactMatch;

  // 3. Búsqueda por inclusión / similitud
  const partialMatch = patients.find(p => {
    const pName = normalizeText(p.name || '');
    const pFullName = normalizeText(`${p.nombres || ''} ${p.apellidos || ''}`);
    if (pName && (targetName.includes(pName) || pName.includes(targetName))) return true;
    if (pFullName && (targetName.includes(pFullName) || pFullName.includes(targetName))) return true;
    return false;
  });

  return partialMatch;
};

export const getAppointmentReminderMessage = (
  appt: AppointmentWhatsAppSource,
  patient?: Patient
): string => {
  const firstName = (patient?.nombres || appt.patientName.split(' ')[0] || 'Paciente').trim();
  return `¡Hola ${firstName}! 👋 Te saludamos de Dental San Miguel. ✨ Te recordamos tu cita hoy a las ${appt.time} para el tratamiento de ${appt.procedure}. Por favor, confirma tu asistencia. ¡Te esperamos! 🦷`;
};

export const openWhatsAppUrl = (phone: string, message: string): void => {
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Copiar al portapapeles automáticamente como respaldo en texto enriquecido UTF-8
  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(message).catch(() => {});
  }

  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // En escritorio, web.whatsapp.com directo evita la pantalla intermedia de redirección que corrompe los emojis en diamantes negros ()
  const whatsappUrl = isMobile
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`
    : `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
    
  window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
};

export const sendAppointmentWhatsAppReminder = (
  appt: AppointmentWhatsAppSource,
  patients: Patient[]
): void => {
  const patient = findPatientForAppointment(appt, patients);
  let phone = formatPhoneForWhatsApp(patient?.phone);

  if (!phone) {
    const manualInput = window.prompt(
      `No se encontró número registrado para "${appt.patientName}". Ingrese el número de WhatsApp (ej. 987654321):`
    );
    if (manualInput) {
      phone = formatPhoneForWhatsApp(manualInput);
    }
  }

  if (!phone) {
    return;
  }

  const message = getAppointmentReminderMessage(appt, patient);
  openWhatsAppUrl(phone, message);
};
