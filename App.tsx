
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ViewMode, Patient, ClinicalService, InventoryNote, AppNotification, User, Tooth, AdvancePayment, ClinicalNote, Treatment, NotificationSoundProfile, RecentActivity } from './types';
import { INITIAL_TEETH_IDS, MOCK_SERVICES } from './constants';
import { supabase } from './services/supabaseClient';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import PatientClinicalRecord from './components/PatientClinicalRecord';
import PatientList from './components/PatientList';
import Scheduling from './components/Scheduling';
import NewPatientModal from './components/NewPatientModal';
import AuthScreen from './components/AuthScreen';
import FinanceReport from './components/FinanceReport';
import FinanceProtection from './components/FinanceProtection';
import Services from './components/Services';
import Settings from './components/Settings';
import OdontogramDigital from './components/OdontogramDigital';
import BackupVigilante from './components/BackupVigilante';
import { downloadPatientZip as _downloadPatientZipUtil } from './utils/patientExportUtils';
import { backblazeService } from './services/backblaze';


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

const getTodayDateStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getCurrentTimeStr = () => {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const App: React.FC = () => {
  const appSessionId = useMemo(() => Math.random().toString(36).substring(2, 11), []);
  const currentUserRef = useRef<User | null>(null);

  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const [currentView, setCurrentView] = useState<ViewMode>(ViewMode.DASHBOARD);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [inventoryNotes, setInventoryNotes] = useState<InventoryNote[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [services, setServices] = useState<ClinicalService[]>(MOCK_SERVICES);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [patientInitialTab, setPatientInitialTab] = useState<'summary' | 'caja'>('summary');
  const [selectedPatientImages, setSelectedPatientImages] = useState<any[]>([]);

  const handleSelectPatient = (id: string, initialTab: 'summary' | 'caja' = 'summary') => {
    setSelectedPatientId(id);
    setPatientInitialTab(initialTab);
    setCurrentView(ViewMode.PATIENTS);
    if (window.innerWidth < 1024) setIsSidebarVisible(false);
  };

  // On-demand fetch of heavy gallery images for selected patient (Saves 99.9% database bandwidth!)
  useEffect(() => {
    if (!selectedPatientId) {
      setSelectedPatientImages([]);
      return;
    }
    const fetchFullImages = async () => {
      try {
        const { data, error } = await supabase
          .from('galeria_clinica')
          .select('id, fecha, url_foto, descripcion')
          .eq('paciente_id', selectedPatientId)
          .order('fecha', { ascending: false });
        if (error) throw error;
        if (data) {
          const formatted = data.map((g: any) => ({
            id: g.id,
            date: new Date(g.fecha).toISOString(),
            url: g.url_foto,
            label: g.descripcion || 'Imagen Clínica'
          }));
          setSelectedPatientImages(formatted);

          // Auto-migrar en segundo plano imágenes antiguas (dataUrl) hacia Backblaze B2
          const currentPat = patients.find(p => p.id === selectedPatientId);
          const patName = currentPat ? (currentPat.name || `${currentPat.nombres || ''} ${currentPat.apellidos || ''}`.trim()) : '';

          for (const item of data) {
            if (item.url_foto && item.url_foto.startsWith('data:image')) {
              try {
                const res = await backblazeService.uploadClinicalImage({
                  dataUrl: item.url_foto,
                  patientId: selectedPatientId,
                  patientName: patName,
                  label: item.descripcion || 'Captura Clínica'
                });
                if (res && res.url && res.url.includes('backblazeb2.com')) {
                  await supabase.from('galeria_clinica').update({ url_foto: res.url }).eq('id', item.id);
                  setSelectedPatientImages(prev => prev.map(img => img.id === item.id ? { ...img, url: res.url } : img));
                  console.log(`[B2 Auto-Migración] Foto ${item.id} migrada a Backblaze B2: ${res.url}`);
                }
              } catch (migErr) {
                console.warn('[B2 Auto-Migración] No se pudo migrar imagen antigua:', migErr);
              }
            }
          }
        }
      } catch (err) {
        console.error("Error loading selected patient full gallery images:", err);
      }
    };
    fetchFullImages();
  }, [selectedPatientId]);
  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);
  const [patientToEdit, setPatientToEdit] = useState<Patient | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFinanceUnlocked, setIsFinanceUnlocked] = useState(false);
  const [lastSync, setLastSync] = useState<string>(new Date().toLocaleTimeString());
  const [isSyncing, setIsSyncing] = useState(false);
  const [shortcutIds, setShortcutIds] = useState<string[]>([]);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false); // Por defecto oculto en móviles
  // const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]); // Removed this state

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('sm_dental_theme');
    return (saved as 'light' | 'dark') || 'dark';
  });

  const [soundProfile, setSoundProfile] = useState<NotificationSoundProfile>(() => {
    const saved = localStorage.getItem('sm_dental_sound_profile');
    return (saved as NotificationSoundProfile) || 'digital';
  });

  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [localStorageChangeTrigger, setLocalStorageChangeTrigger] = useState(0);
  const [showNewPatientsPrompt, setShowNewPatientsPrompt] = useState(false);
  const [downloadProgressInfo, setDownloadProgressInfo] = useState<{ current: number; total: number; currentName: string } | null>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('dismissed_patient_backup_ids');
      if (saved) {
        dismissedPatientIdsRef.current = new Set(JSON.parse(saved));
      }
    } catch (e) {
      // Ignorar si sessionStorage no está disponible
    }
  }, []);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Notificar al usuario que la app ya es instalable directamente
      setTimeout(() => {
        addNotification('patient', 'Instalación Lista', 'Hemos detectado que puedes instalar esta App en tu equipo para usarla sin navegador.', false);
      }, 5000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallApp = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          addNotification('patient', 'Instalación', '¡La aplicación se ha instalado correctamente!', false);
        }
        setDeferredPrompt(null);
      });
    } else {
      setIsInstallModalOpen(true);
    }
  };

  // Auto-mostrar sidebar en pantallas grandes
  useEffect(() => {
    const checkWidth = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarVisible(true);
      } else {
        setIsSidebarVisible(false);
      }
    };
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('sm_dental_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('sm_dental_sound_profile', soundProfile);
  }, [soundProfile]);

  const logActivity = async (type: RecentActivity['type'], description: string, patientName: string, amount?: number) => {
    const effectivePatientName = patientName.trim() || 'SISTEMA'; 
    const activityData = {
      type,
      description: description.toUpperCase(),
      patient_name: effectivePatientName.toUpperCase(),
      amount,
      author: `${currentUser?.name || 'Sistema'} | ${appSessionId}`
    };
    
    try {
      const { error } = await supabase.from('actividades').insert([activityData]);
      if (error) throw error;
    } catch (err) {
      console.error("Error logging activity to Supabase:", err);
    }
  };

  const playNotificationSound = (type: AppNotification['type'], isAbono: boolean = false, forcedProfile?: NotificationSoundProfile) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const activeProfile = forcedProfile || soundProfile;
      const now = ctx.currentTime;

      if (activeProfile === 'nature') {
        if (isAbono) {
          // Gota de agua cayendo alegre ("Plop-plop!") dulce y orgánica
          const playDrop = (delay: number, startFreq: number, endFreq: number) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            
            // Frecuencia desciende rápido para imitar el impacto de una gota
            osc.frequency.setValueAtTime(startFreq, now + delay);
            osc.frequency.exponentialRampToValueAtTime(endFreq, now + delay + 0.08);
            
            gain.gain.setValueAtTime(0.001, now + delay);
            gain.gain.linearRampToValueAtTime(0.12, now + delay + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.08);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + delay);
            osc.stop(now + delay + 0.09);
          };

          playDrop(0, 1500, 700);
          playDrop(0.1, 1800, 950);
        } else {
          // Campanas de viento cristalinas y relajantes (Wind chimes)
          const playChime = (delay: number, freq: number, duration: number) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + delay);
            
            gain.gain.setValueAtTime(0.001, now + delay);
            gain.gain.linearRampToValueAtTime(0.05, now + delay + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + duration);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + delay);
            osc.stop(now + delay + duration + 0.02);
          };

          // Hermoso acorde pentatónico de campana de viento pura
          playChime(0, 1174.66, 1.2);    // D6
          playChime(0.08, 1318.51, 1.0); // E6
          playChime(0.16, 1567.98, 0.8); // G6
          playChime(0.24, 1760.00, 0.6); // A6
        }
      } else if (activeProfile === 'zen') {
        if (isAbono) {
          // Cuenco Tibetano Armónico / Gong Alegre de caja
          const playBowlTone = (freq: number, volume: number, duration: number) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);
            
            // Suave ataque ("slow attack") para dar la sensación física de cuenco de metal
            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(volume, now + 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + duration + 0.05);
          };

          // Un acorde mayor resplandeciente
          playBowlTone(523.25, 0.08, 1.5); // C5 (Campana fundamental)
          playBowlTone(659.25, 0.06, 1.3); // E5 (Tercera dulce)
          playBowlTone(783.99, 0.05, 1.1); // G5 (Quinta clara)
          playBowlTone(525.00, 0.04, 1.5); // Tono extra ligeramente desafinado para crear el clásico batido físico de reverberación
        } else {
          // Cuenco Tibetano Meditativo Profundo ("Gong Zen")
          const playZenBowl = (freq: number, volume: number, duration: number) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'triangle'; // Sonido de triángulo súper cálido, filtrando armónicos duros
            osc.frequency.setValueAtTime(freq, now);
            
            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(volume, now + 0.12); // Ataque de onda largo
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + duration + 0.05);
          };

          playZenBowl(220.00, 0.10, 2.0); // A3 (Bajo profundo de meditación)
          playZenBowl(330.00, 0.06, 1.8); // E4 (Ondas armónicas pacíficas)
          playZenBowl(277.18, 0.04, 1.6); // C#4 (Tono medio equilibrante)
        }
      } else { // 'digital' - Profesional
        if (isAbono) {
          // Arpegio digital ascendente y emocionante "Chirp scale!"
          const playChirp = (delay: number, freq: number) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            // Onda senoidal de transiente ultra-rápida
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + delay);
            
            gain.gain.setValueAtTime(0.001, now + delay);
            gain.gain.linearRampToValueAtTime(0.08, now + delay + 0.005);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.12);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + delay);
            osc.stop(now + delay + 0.13);
          };

          playChirp(0, 523.25);      // C5
          playChirp(0.05, 659.25);   // E5
          playChirp(0.10, 783.99);   // G5
          playChirp(0.15, 1046.50);  // C6 (Campana de meta)
        } else {
          // Ping doble digital moderno de alta tecnología (Crisp double beep)
          const playDigitalBeep = (delay: number, freq: number, duration: number) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + delay);
            
            gain.gain.setValueAtTime(0.001, now + delay);
            gain.gain.linearRampToValueAtTime(0.07, now + delay + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + duration);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + delay);
            osc.stop(now + delay + duration + 0.02);
          };

          playDigitalBeep(0, 1174.66, 0.14);  // D6 (Ping inicial agresivo)
          playDigitalBeep(0.07, 1567.98, 0.22); // G6 (Ping de resolución)
        }
      }
    } catch (err) {
      console.log("Audio synthesis blocked or not supported:", err);
    }
  };

  const addNotification = (type: AppNotification['type'], title: string, message: string, isAbono: boolean = false) => {
    const newNotif: AppNotification = { 
      id: Math.random().toString(36).substr(2, 9), 
      type, 
      title, 
      message, 
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
      read: false 
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, 15));
    playNotificationSound(type, isAbono);
  };

  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedFetchAll = (silent = true) => {
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    fetchTimeoutRef.current = setTimeout(() => {
      fetchAllData(silent);
    }, 450);
  };

  const fetchAllData = async (silent = false) => {
    if (!silent) setIsSyncing(true);
    try {
      const { data: dbFinanzas } = await supabase.from('finanzas').select('*').order('fecha', { ascending: false });
      const { data: dbGaleria } = await supabase.from('galeria_clinica').select('id, paciente_id, fecha, descripcion').order('fecha', { ascending: false });
      // FIX: Leer de la vista pacientes_activos
      const { data: dbPatients } = await supabase.from('pacientes_activos').select('*').order('created_at', { ascending: false });
      // const { data: dbActivities } = await supabase.from('actividades').select('*').order('created_at', { ascending: false }).limit(40); // Removed fetching activities
      
      // if (dbActivities) { // Removed setting recent activities
      //   setRecentActivities(dbActivities.map(a => ({
      //     id: a.id,
      //     type: a.type as any,
      //     description: a.description,
      //     patientName: a.patient_name,
      //     timestamp: a.created_at,
      //     amount: a.amount,
      //     author: a.author
      //   })));
      // }

      if (dbPatients) {
        setPatients(dbPatients.map(p => {
          let extra: any = {};
          try { extra = typeof p.observaciones === 'string' ? JSON.parse(p.observaciones) : (p.observaciones || {}); } catch(e) { extra = {}; }
          
          let lastRelevantUpdate = p.updated_at ? new Date(p.updated_at) : new Date(p.created_at);
          const patientImages = dbGaleria ? dbGaleria.filter((g: any) => g.paciente_id === p.id) : [];
          const imagesFormatted = patientImages.map((g: any) => ({ id: g.id, date: new Date(g.fecha).toISOString(), url: (g as any).url_foto || '', label: g.descripcion || 'Imagen Clínica' }));

          if (imagesFormatted.length > 0) {
            const latestImageTimestamp = imagesFormatted.reduce((latestTs, current) => {
              const currentDate = new Date(current.date);
              const latestDate = new Date(latestTs);
              return currentDate > latestDate ? currentDate.toISOString() : latestTs;
            }, imagesFormatted[0].date);

            const latestImageDate = new Date(latestImageTimestamp);
            if (latestImageDate > lastRelevantUpdate) {
              lastRelevantUpdate = latestImageDate;
            }
          }

          const patientFullName = `${p.nombres || ''} ${p.apellidos || ''}`.trim();
          const effectivePatientName = patientFullName || `Paciente ID: ${p.id.substring(0, 5)}`;

          return {
            id: p.id,
            name: effectivePatientName,
            nombres: p.nombres,
            apellidos: p.apellidos,
            dni: p.dni,
            fecha_nacimiento: p.fecha_nacimiento,
            age: p.fecha_nacimiento ? new Date().getFullYear() - new Date(p.fecha_nacimiento).getFullYear() : 0,
            gender: p.genero || 'Other',
            email: p.email,
            phone: p.telefono,
            address: p.direccion,
            photo: extra.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(effectivePatientName.replace(/ /g, '+'))}&background=random`,
            alerts: extra.alerts || [],
            medicalFlags: p.antecedentes_medicos || { heartProblems: false, coagulation: false, asthma: false, hypertension: false, diabetes: false, epilepsy: false, pregnancy: false, allergies: false, anemia: false, others: '' },
            teeth: extra.teeth || INITIAL_TEETH_IDS.map(id => ({ id, fdi: id.toString(), status: 'healthy' })),
            treatmentPlan: extra.treatmentPlan || [],
            clinicalNotes: extra.clinicalNotes || [],
            medicalHistory: p.historial_clinico || [],
            images: imagesFormatted,
            advancePayments: dbFinanzas ? dbFinanzas.filter((f: any) => f.paciente_id === p.id).map((f: any) => {
              let items: ReceiptItem[] | undefined = undefined;
              let description = f.descripcion || '';
              if (description && description.startsWith('ITEMS_JSON:')) {
                try {
                  const jsonStr = description.substring('ITEMS_JSON:'.length);
                  items = JSON.parse(jsonStr);
                  if (items && items.length > 0) {
                    description = items.map(item => `${item.description.toUpperCase()} (${f.moneda === 'USD' ? '$' : 'S/'}${item.unitPrice.toFixed(2)})`).join(', ');
                  }
                } catch (e) {
                  console.error("Error parsing items JSON:", e);
                }
              }
              return { 
                id: f.id, 
                date: f.fecha, 
                time: f.hora, 
                amount: f.monto, 
                currency: f.moneda, 
                description: description, 
                type: f.tipo_movimiento, 
                author: f.autor,
                items: items
              };
            }) : [],
            updated_at: lastRelevantUpdate.toISOString(),
          } as Patient;
        }));
      }

      const { data: dbCitas } = await supabase.from('citas').select('*, pacientes(nombres, apellidos, telefono)').order('fecha', { ascending: true });
      if (dbCitas) {
        setAppointments(dbCitas.map(c => ({
          id: c.id,
          paciente_id: c.paciente_id,
          patientName: c.pacientes ? `${c.pacientes.nombres} ${c.pacientes.apellidos}`.trim() || `Paciente Cita: ${c.id.substring(0,5)}` : (c.motivo?.includes('|') ? c.motivo.split('|')[0].trim() : 'Desconocido'),
          procedure: c.pacientes ? c.motivo : (c.motivo?.includes('|') ? c.motivo.split('|')[1].trim() : c.motivo),
          date: c.fecha,
          time: c.hora,
          color: 'primary',
          status: c.estado === 'completado' ? 'completed' : 'scheduled',
          reminderSet: !!c.recordatorio_enviado
        })));
      }

      const { data: dbInv } = await supabase.from('inventario').select('*').order('fecha', { ascending: false });
      if (dbInv) {
        setInventoryNotes(dbInv.map(n => ({ id: n.id, text: n.texto, author: n.author, date: n.fecha, time: n.hora, status: n.status as 'pending' | 'completed' })));
      }
    } catch (err) { console.error("Sync error:", err); } finally { setIsSyncing(false); setLastSync(new Date().toLocaleTimeString()); }
  };

  useEffect(() => {
    const saved = localStorage.getItem('sm_dental_session');
    if (saved) setCurrentUser(JSON.parse(saved));
    fetchAllData();
    
    // FIX: Ahora las políticas de RLS están en db_setup.sql, no se necesita acceso anónimo total.
    // La suscripción a cambios en `pacientes` debe ser sobre la tabla base, no la vista,
    // para que cualquier cambio (incluyendo soft delete) se refleje.
    const channel = supabase.channel('all_global_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pacientes' }, () => debouncedFetchAll(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'galeria_clinica' }, () => debouncedFetchAll(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finanzas' }, () => debouncedFetchAll(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'citas' }, () => debouncedFetchAll(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventario' }, () => debouncedFetchAll(true))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'actividades' }, (payload: any) => {
        debouncedFetchAll(true);
        const newAct = payload.new;
        if (newAct && newAct.author) {
          const parts = newAct.author.split('|');
          const authorName = (parts[0] || '').trim();
          const authorSessionId = (parts[1] || '').trim();
          
          if (!authorSessionId || authorSessionId !== appSessionId) {
            // Reproducir alarma/timbre en el dispositivo en tiempo real
            playNotificationSound('patient', newAct.type === 'income');
            
            const desc = newAct.description || 'CAMBIO EN CLÍNICA';
            const patName = newAct.patient_name || 'PACIENTE';
            addNotification('patient', 'Cambio Remoto', `${desc}: ${patName} por ${authorName}`, newAct.type === 'income');
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [appSessionId]);

  const handleUpdatePatientData = async (id: string, updates: Partial<Patient>) => {
    const patient = patients.find(p => p.id === id);
    if (patient) {
      await logActivity('update', 'ACTUALIZACIÓN DE DATOS CLÍNICOS', patient.name);
    }
    
    setPatients(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    try {
      const { data: current } = await supabase.from('pacientes').select('*').eq('id', id).single();
      const dbPayload: any = {
        nombres: updates.nombres || current.nombres,
        apellidos: updates.apellidos || current.apellidos,
        dni: updates.dni || current.dni,
        telefono: updates.phone || current.telefono,
        email: updates.email || current.email,
        direccion: updates.address || current.direccion,
        fecha_nacimiento: updates.fecha_nacimiento || current.fecha_nacimiento,
        genero: updates.gender || current.gender,
        antecedentes_medicos: updates.medicalFlags || current.antecedentes_medicos,
        historial_clinico: updates.medicalHistory || current.historial_clinico || []
      };

      if (updates.clinicalNotes || updates.treatmentPlan || updates.teeth) {
        const obs = current.observaciones || {};
        dbPayload.observaciones = { ...obs, clinicalNotes: updates.clinicalNotes || obs.clinicalNotes || [], treatmentPlan: updates.treatmentPlan || obs.treatmentPlan || [], teeth: updates.teeth || obs.teeth || [] };
      }

      const { error } = await supabase.from('pacientes').update(dbPayload).eq('id', id);
      if (error) throw error;
    } catch (err: any) { 
      fetchAllData(true);
      alert("Error al sincronizar: " + err.message); 
    }
  };

  const handleDeletePatient = async (id: string) => {
    const patient = patients.find(p => p.id === id);
    if (!patient) return;

    try {
      await logActivity('delete', 'PACIENTE ELIMINADO LÓGICAMENTE', patient.name);
      // FIX: Cambiar a soft delete (update deleted_at)
      const { error } = await supabase.from('pacientes').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;

      // Actualizar el estado local para eliminar al paciente de la vista
      setPatients(prev => prev.filter(p => p.id !== id));
      addNotification('patient', 'Paciente Eliminado', `${patient.name} ha sido archivado (borrado lógico).`, false);
    } catch (err: any) {
      console.error("Error al realizar soft delete:", err);
      alert("Error al archivar paciente: " + err.message);
      fetchAllData(true); // Re-fetch para asegurar consistencia
    }
  };

  const handleAddGalleryImage = async (patientId: string, url: string, label: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (patient) await logActivity('photo', `NUEVA IMAGEN: ${label.toUpperCase()}`, patient.name);
    
    let finalUrl = url;

    // Subir a Backblaze B2 para no saturar la cuota gratuita de Supabase (Compatible con Cloudflare y Node.js)
    if (url.startsWith('data:image')) {
      try {
        const patientName = patient ? (patient.name || `${patient.nombres || ''} ${patient.apellidos || ''}`.trim()) : '';
        const uploadRes = await backblazeService.uploadClinicalImage({
          dataUrl: url,
          patientId,
          patientName,
          label
        });
        if (uploadRes && uploadRes.url) {
          finalUrl = uploadRes.url;
          console.log('[Backblaze B2] Imagen guardada en la nube:', finalUrl);
        }
      } catch (uploadErr) {
        console.warn('Error subiendo imagen a Backblaze B2, guardando fallback:', uploadErr);
      }
    }

    const { data, error } = await supabase.from('galeria_clinica').insert([{ paciente_id: patientId, url_foto: finalUrl, descripcion: label }]).select();
    if (error) {
      alert("Error subiendo foto: " + error.message);
    } else {
      if (selectedPatientId === patientId) {
        setSelectedPatientImages(prev => [
          {
            id: (data && data[0]?.id) || Math.random().toString(36).substr(2, 9),
            date: new Date().toISOString(),
            url: finalUrl,
            label: label || 'Imagen Clínica'
          },
          ...prev
        ]);
      }
      debouncedFetchAll(true);
    }
  };

  const selectedPatient = useMemo(() => {
    const found = patients.find(p => p.id === selectedPatientId);
    if (!found) return found;
    return {
      ...found,
      images: selectedPatientImages
    };
  }, [patients, selectedPatientId, selectedPatientImages]);

  const patientsNeedingBackup = useMemo(() => {
    const lastPatientZipDownloadStatus: Record<string, string> = JSON.parse(
      localStorage.getItem('lastPatientZipDownloadStatus') || '{}'
    );
    const needingBackup: Set<string> = new Set();

    patients.forEach(p => {
      if (!p.updated_at) {
        if (!lastPatientZipDownloadStatus[p.id]) {
          needingBackup.add(p.id);
        }
        return;
      }

      const lastDownloadedTimestamp = lastPatientZipDownloadStatus[p.id];
      const patientUpdatedAt = new Date(p.updated_at);

      if (!lastDownloadedTimestamp || patientUpdatedAt > new Date(lastDownloadedTimestamp)) {
        needingBackup.add(p.id);
      }
    });
    return needingBackup;
  }, [patients, localStorageChangeTrigger]);

  // Lista de pacientes detectados que necesitan descarga
  const newPatientsNeedingBackupList = useMemo(() => {
    return patients.filter(p => patientsNeedingBackup.has(p.id));
  }, [patients, patientsNeedingBackup]);

  // Si apreta 'No': "que no pase nada" (no descarga nada y cierra el recuadro)
  const handleDeclineDownloadNew = () => {
    setShowNewPatientsPrompt(false);
  };

  // Si apreta 'Sí': descargar todos los nuevos pacientes identificados
  const handleConfirmDownloadAllNew = async () => {
    if (newPatientsNeedingBackupList.length === 0) {
      setShowNewPatientsPrompt(false);
      return;
    }

    setIsBulkDownloading(true);
    const total = newPatientsNeedingBackupList.length;
    let successfulCount = 0;

    for (let i = 0; i < total; i++) {
      const patient = newPatientsNeedingBackupList[i];
      setDownloadProgressInfo({
        current: i + 1,
        total,
        currentName: patient.name || `${patient.nombres || ''} ${patient.apellidos || ''}`.trim()
      });

      const success = await _downloadPatientZipUtil(patient);
      if (success) {
        successfulCount++;
        dismissedPatientIdsRef.current.add(patient.id);
      } else {
        console.error(`Fallo al descargar ZIP para ${patient.name}`);
        addNotification('security', 'Error de Descarga', `Fallo al descargar información de ${patient.name}.`, false);
      }
      await new Promise(resolve => setTimeout(resolve, 400));
    }

    setDownloadProgressInfo(null);
    setIsBulkDownloading(false);
    setShowNewPatientsPrompt(false);
    setLocalStorageChangeTrigger(prev => prev + 1);
    addNotification('security', 'Descarga Completada', `Se descargó la información completa de ${successfulCount} paciente(s).`, false);
  };

  const handleDownloadAllNeededZips = async () => {
    if (patientsNeedingBackup.size === 0) return;
    // En vez de descargar automáticamente, abrir el recuadro de confirmación
    setShowNewPatientsPrompt(true);
  };

  const handleNewPatientSubmit = async (newOrUpdatedPatient: Patient) => {
    setIsSyncing(true);
    const prevPatients = [...patients]; // Snapshot para rollback
    let optimisticPatientId = newOrUpdatedPatient.id;

    try {
      const nameParts = newOrUpdatedPatient.name.trim().split(/\s+/);
      const fn = nameParts[0];
      const ln = nameParts.slice(1).join(' ') || ' ';
      
      const dbPayload: any = {
        nombres: fn,
        apellidos: ln,
        dni: newOrUpdatedPatient.dni || null,
        telefono: newOrUpdatedPatient.phone || null,
        email: newOrUpdatedPatient.email || null,
        direccion: newOrUpdatedPatient.address || null,
        fecha_nacimiento: newOrUpdatedPatient.fecha_nacimiento || null,
        genero: newOrUpdatedPatient.gender,
        antecedentes_medicos: newOrUpdatedPatient.medicalFlags,
        historial_clinico: newOrUpdatedPatient.medicalHistory,
        observaciones: { 
          alerts: newOrUpdatedPatient.alerts, 
          teeth: newOrUpdatedPatient.teeth, 
          treatmentPlan: newOrUpdatedPatient.treatmentPlan, 
          clinicalNotes: newOrUpdatedPatient.clinicalNotes, 
          photo: newOrUpdatedPatient.photo 
        }
      };

      if (patientToEdit) { // Editando paciente existente
        // Actualización optimista de la lista
        setPatients(prev => prev.map(p => p.id === newOrUpdatedPatient.id ? { ...newOrUpdatedPatient, nombres: fn, apellidos: ln } : p));
        setSelectedPatientId(newOrUpdatedPatient.id);
        setIsNewPatientModalOpen(false); // Cerrar modal inmediatamente
        
        await supabase.from('pacientes').update(dbPayload).eq('id', newOrUpdatedPatient.id);
        await logActivity('update', 'DATOS ACTUALIZADOS', newOrUpdatedPatient.name);
        addNotification('patient', 'Paciente Actualizado', `Los datos de ${newOrUpdatedPatient.name} han sido guardados.`);
      } else { // Creando nuevo paciente
        // Supabase generará un ID, pero para la actualización optimista, generamos uno temporal
        const tempId = Math.random().toString(36).substr(2, 9);
        optimisticPatientId = tempId; // Usar ID temporal para optimista

        const optimisticNewPatient: Patient = {
          ...newOrUpdatedPatient,
          id: tempId,
          nombres: fn,
          apellidos: ln,
          updated_at: new Date().toISOString(), // Simular fecha de creación
        };
        setPatients(prev => [optimisticNewPatient, ...prev]);
        setSelectedPatientId(tempId);
        setIsNewPatientModalOpen(false); // Cerrar modal inmediatamente

        const { data, error } = await supabase.from('pacientes').insert([dbPayload]).select();
        if (error) throw error;
        
        if (data?.[0]) {
          // Reemplazar paciente optimista con el real de Supabase
          setPatients(prev => prev.map(p => p.id === tempId ? { ...optimisticNewPatient, id: data[0].id, created_at: data[0].created_at, updated_at: data[0].updated_at || data[0].created_at || new Date().toISOString() } : p));
          setSelectedPatientId(data[0].id);
          await logActivity('update', 'NUEVO PACIENTE REGISTRADO', newOrUpdatedPatient.name);
          addNotification('patient', 'Nuevo Paciente', `${newOrUpdatedPatient.name} ha sido registrado exitosamente.`);
        }
      }
      fetchAllData(true); // Una llamada silenciosa para revalidar por si acaso
    } catch (err: any) {
      alert("Error al sincronizar: " + err.message);
      // Rollback del estado de pacientes
      setPatients(prevPatients); 
      setIsNewPatientModalOpen(true); // Reabrir modal en caso de error para que el usuario reintente
    } finally {
      setIsSyncing(false);
    }
  };


  const todayPatients = useMemo(() => {
    const todayStr = getTodayDateStr();
    const todayAppointments = appointments.filter(appt => appt.date === todayStr);
    return patients.filter(p => {
      const hasIdMatch = todayAppointments.some(appt => appt.paciente_id === p.id);
      if (hasIdMatch) return true;
      const hasNameMatch = todayAppointments.some(appt => {
        const apptName = appt.patientName?.toLowerCase().trim();
        if (!apptName) return false;
        const pName = p.name?.toLowerCase().trim();
        const pFullName = `${p.nombres || ''} ${p.apellidos || ''}`.toLowerCase().trim();
        return apptName === pName || apptName === pFullName;
      });
      return hasNameMatch;
    });
  }, [appointments, patients]);

  if (!currentUser) return <AuthScreen onLogin={u => { setCurrentUser(u); localStorage.setItem('sm_dental_session', JSON.stringify(u)); fetchAllData(); }} />;

  return (
    <div className="flex h-screen bg-background-light dark:bg-background-dark overflow-hidden transition-colors duration-300 relative">
      {/* Sidebar con Overlay para móviles */}
      {isSidebarVisible && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden transition-opacity animate-in fade-in"
          onClick={() => setIsSidebarVisible(false)}
        ></div>
      )}
      
      <div className={`
        fixed inset-y-0 left-0 z-50 transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 shrink-0
        ${isSidebarVisible ? 'translate-x-0 w-64' : '-translate-x-full w-64 lg:w-0'}
      `}>
        <Sidebar 
          currentView={currentView} 
          onViewChange={(v) => { setCurrentView(v); if(window.innerWidth < 1024) setIsSidebarVisible(false); }} 
          onNewPatient={() => { setPatientToEdit(undefined); setIsNewPatientModalOpen(true); if(window.innerWidth < 1024) setIsSidebarVisible(false); }} 
          shortcuts={todayPatients} 
          onSelectPatient={(id, tab) => handleSelectPatient(id, tab)} 
          onHide={() => setIsSidebarVisible(false)} 
          onDownloadAllNewZips={handleDownloadAllNeededZips}
          patientsNeedingBackupCount={patientsNeedingBackup.size}
          isBulkDownloading={isBulkDownloading}
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden w-full">
        <Header searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchResults={patients.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))} onSelectPatient={id => handleSelectPatient(id, 'summary')} onLogout={() => { setCurrentUser(null); localStorage.removeItem('sm_dental_session'); }} onOpenSettings={() => setCurrentView(ViewMode.CONFIGURATION)} user={currentUser} notifications={notifications} onMarkRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))} onClearAll={() => setNotifications([])} isSidebarVisible={isSidebarVisible} onToggleSidebar={() => setIsSidebarVisible(!isSidebarVisible)} />
        <main className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/20 scrollbar-hide">
          {currentView === ViewMode.DASHBOARD && <Dashboard patients={patients} appointments={appointments} inventoryNotes={inventoryNotes} onSelectPatient={id => handleSelectPatient(id, 'summary')} onViewChange={setCurrentView} lastSync={lastSync} isSyncing={isSyncing} />}
          {currentView === ViewMode.PATIENTS && selectedPatient && <PatientClinicalRecord patient={selectedPatient} initialTab={patientInitialTab} onUpdatePatient={handleUpdatePatientData} onUpdateMedicalFlags={flags => handleUpdatePatientData(selectedPatient.id, { medicalFlags: { ...selectedPatient.medicalFlags, ...flags } })} onAddNote={async txt => {
            await logActivity('note', 'NUEVA NOTA CLÍNICA', selectedPatient.name);
            handleUpdatePatientData(selectedPatient.id, { clinicalNotes: [{ id: Math.random().toString(36).substr(2, 9), date: getTodayDateStr(), time: new Date().toLocaleTimeString(), text: txt, author: currentUser.name }, ...(selectedPatient.clinicalNotes || [])] });
          }} onAddImage={handleAddGalleryImage} onDeleteImage={async iid => { 
            const patient = patients.find(p => p.id === selectedPatientId);
            if (patient) await logActivity('delete', 'IMAGEN ELIMINADA DE GALERÍA', patient.name);
            // ALMACENAMIENTO PERMANENTE EN BACKBLAZE B2:
            // Al eliminar una imagen desde la app, solo se retira la referencia de la vista de la clínica.
            // El archivo físico guardado en Backblaze B2 (dental-san-miguel-fotos) NUNCA se elimina del bucket.
            await supabase.from('galeria_clinica').delete().eq('id', iid);
            setSelectedPatientImages(prev => prev.filter(img => img.id !== iid));
            debouncedFetchAll(true); 
          }} onAddAdvancePayment={async (amt, cur, desc, nts, typ, itms) => { 
            const normalizedType = typ && typ.toLowerCase() === 'cargo' ? 'Cargo' : 'Abono';
            const finalDesc = (itms && itms.length > 0) ? `ITEMS_JSON:${JSON.stringify(itms)}` : desc;
            const { error } = await supabase.from('finanzas').insert([{ 
              paciente_id: selectedPatient.id, 
              monto: amt, 
              moneda: cur, 
              tipo_movimiento: normalizedType, 
              descripcion: finalDesc, 
              autor: currentUser.name,
              fecha: getTodayDateStr(),
              hora: getCurrentTimeStr()
            }]); 
            if (error) {
              alert("Error al registrar en caja: " + error.message);
            } else {
              const isAbono = normalizedType === 'Abono';
              await logActivity(isAbono ? 'income' : 'update', `${isAbono ? 'INGRESO' : 'CARGO'}: ${desc}`, selectedPatient.name, amt);
              addNotification(isAbono ? 'finance' : 'patient', isAbono ? 'Ingreso de Caja' : 'Cargo Registrado', `Se registró un ${normalizedType} de ${cur === 'USD' ? '$' : 'S/'}${amt.toLocaleString()}.`, isAbono);
              fetchAllData(true); 
            }
          }} onDeleteAdvancePayment={async pid => { 
            const p = patients.find(p => p.id === selectedPatientId);
            if (p) await logActivity('delete', 'MOVIMIENTO DE CAJA ANULADO', p.name);
            await supabase.from('finanzas').delete().eq('id', pid); fetchAllData(true); 
          }} currentUser={currentUser} onAddTreatment={()=>{}} onUpdateTreatment={()=>{}} onDeleteTreatment={()=>{}} onDeleteNote={()=>{}} onUpdateAdvancePayment={()=>{}} />}
          {currentView === ViewMode.PATIENTS_LIST && <PatientList patients={patients} onSelectPatient={id => handleSelectPatient(id, 'summary')} onDeletePatient={handleDeletePatient} onEditPatient={p => { setPatientToEdit(p); setIsNewPatientModalOpen(true); }} onNewPatient={() => { setPatientToEdit(undefined); setIsNewPatientModalOpen(true); }} shortcutIds={shortcutIds} onToggleShortcut={id => setShortcutIds(prev => prev.includes(id) ? prev.filter(sid => sid !== id) : [id, ...prev].slice(0, 5))} patientsNeedingBackup={patientsNeedingBackup} handleDownloadAllNeededZips={handleDownloadAllNeededZips} isBulkDownloading={isBulkDownloading} onBackupSuccess={() => setLocalStorageChangeTrigger(prev => prev + 1)} onOpenBackupPrompt={() => setShowNewPatientsPrompt(true)} />}
          {currentView === ViewMode.APPOINTMENTS && <Scheduling patients={patients} appointments={appointments} setAppointments={fetchAllData} onAddAppt={async (apptData: any) => { 
            await logActivity('appointment', `CITA PROGRAMADA: ${apptData.procedure}`, apptData.patientName);
            addNotification('appointment', 'Nueva Cita', `Se ha programado una nueva cita para ${apptData.patientName}.`); 
          }} />}
          {currentView === ViewMode.FINANCES && (isFinanceUnlocked ? <FinanceReport patients={patients} staffCount={1} /> : <FinanceProtection onUnlock={() => setIsFinanceUnlocked(true)} />)}
          {currentView === ViewMode.CONFIGURATION && <Settings user={currentUser} onUpdateUser={async u => { setCurrentUser({...currentUser, ...u}); }} theme={theme} onThemeChange={setTheme} soundProfile={soundProfile} onSoundProfileChange={(p) => { setSoundProfile(p); playNotificationSound('patient', false, p); }} />}
          {currentView === ViewMode.SERVICES && <Services services={services} onAddService={async s => { 
            setServices([s, ...services]); 
            await logActivity('update', `NUEVO SERVICIO: ${s.name}`, 'SISTEMA');
            addNotification('inventory', 'Nuevo Servicio', `Se agregó ${s.name} al catálogo.`); 
          }} onUpdateService={(id, updates) => {
            setServices(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
          }} onDeleteService={id => {
            const serviceToDelete = services.find(s => s.id === id);
            if (serviceToDelete) {
              setServices(prev => prev.filter(s => s.id !== id));
              logActivity('delete', `SERVICIO ELIMINADO: ${serviceToDelete.name}`, 'SISTEMA');
              addNotification('inventory', 'Servicio Eliminado', `Se eliminó el servicio ${serviceToDelete.name} del catálogo.`);
            }
          }} inventoryNotes={inventoryNotes} onAddInventoryNote={async t => { 
            await supabase.from('inventario').insert([{ texto: t, author: currentUser?.name }]); 
            await logActivity('inventory', `REQUERIMIENTO INVENTARIO: ${t.substring(0, 20)}...`, 'SISTEMA');
            addNotification('inventory', 'Inventario', 'Se registró un nuevo requerimiento de material.'); 
            fetchAllData(); 
          }} onDeleteInventoryNote={async id => { await supabase.from('inventario').delete().eq('id', id); fetchAllData(); }} onToggleInventoryComplete={async id => { const n = inventoryNotes.find(x => x.id === id); await supabase.from('inventario').update({ status: n?.status === 'pending' ? 'completed' : 'pending' }).eq('id', id); fetchAllData(); }} />}
          {currentView === ViewMode.ODONTOGRAM && <OdontogramDigital patients={patients} onAssociateCapture={async (pid, du, n) => { 
            await handleAddGalleryImage(pid, du, 'CAPTURA ODONTOGRAMA'); 
            const p = patients.find(x => x.id === pid); 
            if (p) { 
              await logActivity('photo', 'CAPTURA DE ODONTOGRAMA DIGITAL', p.name);
              handleUpdatePatientData(pid, { clinicalNotes: [{ id: Math.random().toString(36).substr(2, 9), date: getTodayDateStr(), time: new Date().toLocaleTimeString(), text: `[ODONTOGRAMA]: ${n}`, author: currentUser?.name || 'Sistema' }, ...(p.clinicalNotes || [])] }); 
              addNotification('patient', 'Odontograma', `Captura asociada al paciente ${p.name}.`); 
            } 
          }} />}
        </main>
      </div>
      {isNewPatientModalOpen && <NewPatientModal patient={patientToEdit} onClose={() => setIsNewPatientModalOpen(false)} onSubmit={handleNewPatientSubmit} />}
      {isInstallModalOpen && (
        <div id="pwa-install-modal" className="fixed inset-0 bg-slate-900/60 dark:bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 transition-all transform scale-100">
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-3xl animate-bounce">install_desktop</span>
                <div>
                  <h3 className="text-lg font-black tracking-tight leading-none">Instalar Aplicación</h3>
                  <p className="text-blue-100 text-xs mt-1">Lleva la Clínica Dental San Miguel en tu escritorio</p>
                </div>
              </div>
              <button 
                onClick={() => setIsInstallModalOpen(false)}
                className="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto scrollbar-hide">
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                Debido a las políticas de seguridad de cada navegador, a veces la instalación nativa requiere un paso manual simple. Sigue estas rápidas instrucciones según tu caso:
              </p>

              {/* Guía Chrome/Edge en PC */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-blue-500 font-bold">laptop_mac</span>
                  <span className="font-bold text-sm text-slate-800 dark:text-slate-200">Google Chrome / Edge (Computadora)</span>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-xs text-slate-600 dark:text-slate-400 leading-normal pl-1">
                  <li>Haz clic en el botón de <strong>Menú (tres puntos verticales <span className="font-mono">⋮</span>)</strong> en la esquina superior derecha del navegador.</li>
                  <li>Ve a la opción de <strong>"Guardar y compartir"</strong> (en inglés <i>"Cast, save, and share</i>).</li>
                  <li>Selecciona <strong>"Instalar página como aplicación..."</strong> o <strong>"Crear acceso directo"</strong> (marcando la casilla <i>"Abrir como ventana"</i>).</li>
                  <li>¡Listo! Tendrás un acceso directo directo en tu escritorio que funciona como un software independiente de escritorio.</li>
                </ol>
              </div>

              {/* Guía Android */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[#3ddc84] font-bold">smartphone</span>
                  <span className="font-bold text-sm text-slate-800 dark:text-slate-200">Dispositivo Android</span>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-xs text-slate-600 dark:text-slate-400 leading-normal pl-1">
                  <li>Abre la aplicación en <strong>Google Chrome</strong> en tu celular.</li>
                  <li>Presiona los <strong>tres puntos <span className="font-mono">⋮</span></strong> en la parte superior derecha.</li>
                  <li>Presiona sobre <strong>"Instalar aplicación"</strong> o bien <strong>"Agregar a la pantalla principal"</strong>.</li>
                </ol>
              </div>

              {/* Guía Safari iOS */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-indigo-500 font-bold">phone_iphone</span>
                  <span className="font-bold text-sm text-slate-800 dark:text-slate-200">Apple iPhone / iPad (Safari)</span>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-xs text-slate-600 dark:text-slate-400 leading-normal pl-1">
                  <li>Abre la aplicación usando de forma obligatoria el navegador <strong>Safari</strong>.</li>
                  <li>Presiona el botón de <strong>Compartir <span className="text-base">⎋</span></strong> (el ícono del cuadro con la flecha hacia arriba en la barra de navegación inferior).</li>
                  <li>Desplázate hacia abajo en el menú y selecciona <strong>"Agregar a inicio"</strong> (o <i>"Add to Home Screen"</i>).</li>
                </ol>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setIsInstallModalOpen(false)}
                className="px-6 py-2.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-all"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECUADRO DE CONFIRMACIÓN: Se identificaron nuevos pacientes */}
      {showNewPatientsPrompt && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#111827] text-white w-full max-w-lg rounded-[32px] p-6 sm:p-8 border-2 border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.8)] flex flex-col items-center relative animate-in zoom-in-95 duration-200">
            {/* Botón cerrar X superior que actúa como 'No' */}
            <button 
              onClick={handleDeclineDownloadNew}
              disabled={isBulkDownloading}
              className="absolute top-5 right-5 size-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              title="Cerrar sin hacer nada"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>

            {/* Ícono de Identificación de Nuevos Pacientes */}
            <div className="size-20 rounded-3xl bg-gradient-to-tr from-emerald-500/20 to-blue-500/20 border border-emerald-500/30 flex items-center justify-center mb-5 shadow-inner">
              <span className="material-symbols-outlined text-4xl text-emerald-400">group_add</span>
            </div>

            {/* Título Principal */}
            <h3 className="text-xl sm:text-2xl font-black text-center text-white tracking-tight mb-2 uppercase">
              Se identificaron nuevos pacientes
            </h3>
            
            {/* Pregunta Solicitada por el Usuario */}
            <p className="text-base sm:text-lg font-bold text-emerald-400 text-center mb-4 leading-snug">
              ¿Deseas descargar su información?
            </p>

            <p className="text-xs text-slate-400 text-center max-w-sm mb-5 leading-relaxed">
              {newPatientsNeedingBackupList.length > 0 ? (
                <>
                  Se encontraron <span className="font-bold text-white">{newPatientsNeedingBackupList.length}</span> paciente(s) nuevo(s) o actualizados desde la nube (otra computadora o región).
                </>
              ) : (
                'No hay descargas pendientes en este momento.'
              )}
            </p>

            {/* Lista previa compacta de pacientes detectados */}
            {newPatientsNeedingBackupList.length > 0 && (
              <div className="w-full max-h-36 overflow-y-auto scrollbar-hide bg-slate-900/70 rounded-2xl p-3 border border-slate-800 mb-6 space-y-1.5">
                {newPatientsNeedingBackupList.slice(0, 6).map(p => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-1.5 bg-slate-800/50 rounded-xl text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className="size-2 rounded-full bg-emerald-400 shrink-0"></span>
                      <span className="font-bold text-slate-200 truncate">{p.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-2">DNI: {p.dni || 'S/D'}</span>
                  </div>
                ))}
                {newPatientsNeedingBackupList.length > 6 && (
                  <p className="text-[10px] font-bold text-slate-500 text-center py-1">
                    + {newPatientsNeedingBackupList.length - 6} paciente(s) adicional(es)
                  </p>
                )}
              </div>
            )}

            {/* Barra de Progreso durante la descarga */}
            {isBulkDownloading && downloadProgressInfo && (
              <div className="w-full mb-6 p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl flex flex-col items-center gap-2 animate-pulse">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-black">
                  <span className="material-symbols-outlined text-base animate-spin">sync</span>
                  <span>Descargando ({downloadProgressInfo.current}/{downloadProgressInfo.total}):</span>
                </div>
                <p className="text-xs font-bold text-white truncate max-w-full">
                  {downloadProgressInfo.currentName}
                </p>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-1">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-300 rounded-full" 
                    style={{ width: `${(downloadProgressInfo.current / downloadProgressInfo.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Botones de Confirmación: 'Sí' descarga todos los nuevos, 'No' que no pase nada */}
            <div className="w-full flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => handleDeclineDownloadNew(false)}
                disabled={isBulkDownloading}
                className="flex-1 h-12 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 hover:text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all active:scale-95 border border-slate-700 cursor-pointer order-2 sm:order-1 flex items-center justify-center"
              >
                No
              </button>

              <button
                onClick={handleConfirmDownloadAllNew}
                disabled={isBulkDownloading || newPatientsNeedingBackupList.length === 0}
                className="flex-[1.5] h-12 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer order-1 sm:order-2 flex items-center justify-center gap-2 border-b-2 border-emerald-800"
              >
                {isBulkDownloading ? (
                  <>
                    <span className="material-symbols-outlined text-base animate-spin">sync</span>
                    Descargando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">download</span>
                    Sí, descargar todos los nuevos ({newPatientsNeedingBackupList.length})
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      <BackupVigilante onAddNotification={addNotification} />
    </div>
  );
};

export default App;
