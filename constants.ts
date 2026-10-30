import { Patient, ToothStatus, MedicalFlags, ClinicalService } from './types';

export const INITIAL_TEETH_IDS = [
  18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
  48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38
];

// Fix: Added missing properties 'allergies' and 'anemia' to match MedicalFlags type
const DEFAULT_FLAGS: MedicalFlags = {
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
};

export const MOCK_SERVICES: ClinicalService[] = [
  { id: 's1', name: 'Limpieza Dental Profunda', description: 'Profilaxis completa con ultrasonido y pulido con pasta diamantada.', basePrice: 120, icon: 'cleaning_services' },
  { id: 's2', name: 'Blanqueamiento LED', description: 'Tratamiento estético de alta intensidad para aclarar hasta 4 tonos.', basePrice: 450, icon: 'auto_fix_high' },
  { id: 's3', name: 'Endodoncia Unirradicular', description: 'Tratamiento de conducto en piezas frontales con sellado termoplástico.', basePrice: 350, icon: 'biotech' },
  { id: 's4', name: 'Extracción de Tercera Molar', description: 'Cirugía menor para muelas del juicio impactadas o erupcionadas.', basePrice: 280, icon: 'potted_plant' },
  { id: 's5', name: 'Ortodoncia Metálica', description: 'Instalación de brackets metálicos de baja fricción (pago inicial).', basePrice: 1200, icon: 'grid_view' }
];

export const MOCK_PATIENTS: Patient[] = [
  {
    id: '88291',
    name: 'Juan Pérez',
    age: 42,
    gender: 'Male',
    email: 'juan.perez@email.com',
    phone: '+51 911 123 456',
    address: 'Av. La Marina 2500, San Miguel',
    photo: 'https://picsum.photos/seed/juan/200',
    alerts: [
      { id: '1', type: 'critical', title: 'Alergia Penicilina', description: 'Reacción severa reportada' }
    ],
    medicalFlags: { ...DEFAULT_FLAGS, hypertension: true },
    teeth: INITIAL_TEETH_IDS.map(id => ({
      id,
      fdi: id.toString(),
      status: (id === 18 || id === 28 || id === 38 || id === 48) ? 'missing' as ToothStatus : 'healthy' as ToothStatus
    })),
    treatmentPlan: [
      { id: 't1', date: '2023-12-05', tooth: '22', surface: 'Mesial', procedure: 'Resina compuesta', status: 'pending', estimate: 85, currency: 'PEN' },
      { id: 't2', date: '2023-12-05', tooth: '14', surface: 'Oclusal', procedure: 'Endodoncia', status: 'in-progress', estimate: 450, currency: 'PEN' }
    ],
    clinicalNotes: [
      { id: 'n1', date: '2023-12-05', time: '10:00', text: 'Paciente presenta dolor en cuadrante superior derecho. Se recomienda placa radiográfica.', author: 'Dra. Yanett Falcon' }
    ],
    // Fix: Added missing medicalHistory property to satisfy Patient interface
    medicalHistory: [],
    images: [
      { id: 'i1', date: '2023-12-05', url: 'https://picsum.photos/seed/xray1/300', label: 'X-Ray Lateral' }
    ],
    advancePayments: [
      { id: 'a1', date: '2023-12-05', amount: 100, description: 'Adelanto inicial', currency: 'PEN' }
    ],
    lastVisit: '2023-12-05'
  }
];