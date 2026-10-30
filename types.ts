
export type ToothStatus = 'healthy' | 'cavity' | 'filling' | 'missing' | 'other' | 'brackets' | 'implant' | 'veneer' | 'crown' | 'bridge' | 'extraction';

export type NotificationSoundProfile = 'digital' | 'nature' | 'zen';

export interface MedicalFlags {
  heartProblems: boolean;
  coagulation: boolean;
  asthma: boolean;
  hypertension: boolean;
  diabetes: boolean;
  epilepsy: boolean;
  pregnancy: boolean;
  allergies: boolean;
  anemia: boolean;
  others: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  photo?: string;
}

export interface Tooth {
  id: number;
  fdi: string;
  status: ToothStatus;
  notes?: string;
}

export interface Treatment {
  id: string;
  date: string;
  time?: string;
  tooth?: string;
  surface?: string;
  procedure: string;
  status: 'pending' | 'in-progress' | 'scheduled' | 'completed' | 'cancelled';
  estimate: number;
  currency: 'PEN' | 'USD';
  notes?: string;
}

export interface ClinicalService {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  icon: string;
  category?: string;
}

export interface Alert {
  id: string;
  type: 'critical' | 'info';
  title: string;
  description: string;
}

export interface ClinicalNote {
  id: string;
  date: string;
  time: string;
  text: string;
  author: string;
}

export interface InventoryNote {
  id: string;
  date: string;
  time: string;
  text: string; // Mapped from 'texto' in DB
  author: string;
  status: 'pending' | 'completed';
}

export interface AppNotification {
  id: string;
  type: 'appointment' | 'patient' | 'finance' | 'inventory' | 'security';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface PatientImage {
  id: string;
  date: string; // Mapped from 'fecha'
  url: string;  // Mapped from 'url_foto'
  label: string; // Mapped from 'descripcion' or 'tipo_imagen'
}

export interface ReceiptItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface AdvancePayment {
  id: string;
  date: string;
  time?: string;
  amount: number; // Mapped from 'monto'
  currency: 'PEN' | 'USD'; // Mapped from 'moneda'
  description: string;
  notes?: string;
  author?: string;
  type?: 'Cargo' | 'Abono'; // Mapped from 'tipo_movimiento'
  items?: ReceiptItem[]; // Nueva propiedad para desglose
}

export interface Patient {
  id: string;
  name: string;
  nombres?: string;
  apellidos?: string;
  dni?: string;
  fecha_nacimiento?: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  email?: string;
  phone?: string;
  address?: string;
  photo: string;
  alerts: Alert[];
  medicalFlags: MedicalFlags;
  teeth: Tooth[];
  treatmentPlan: Treatment[];
  clinicalNotes: ClinicalNote[];
  medicalHistory: ClinicalNote[]; 
  images: PatientImage[];
  advancePayments: AdvancePayment[];
  lastVisit?: string;
  created_at?: string;
  updated_at?: string; // Add updated_at to Patient interface
}

export interface RecentActivity {
  id: string;
  type: 'income' | 'update' | 'delete' | 'note' | 'photo' | 'appointment' | 'inventory';
  description: string;
  patientName: string;
  timestamp: string; // ISO string
  amount?: number;
  author?: string;
}

export enum ViewMode {
  DASHBOARD = 'dashboard',
  PATIENTS = 'patients',
  APPOINTMENTS = 'appointments',
  ODONTOGRAM = 'odontogram',
  INVENTORY = 'inventory',
  PATIENTS_LIST = 'patients_list',
  FINANCES = 'finances',
  SERVICES = 'services',
  MARKETING = 'marketing',
  CONFIGURATION = 'configuration'
}
