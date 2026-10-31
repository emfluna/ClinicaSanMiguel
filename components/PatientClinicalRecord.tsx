
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Patient, MedicalFlags, AdvancePayment, Treatment, User, ClinicalNote, ReceiptItem } from '../types';
import { optimizeClinicalImage } from '../utils/imageOptimizer';

interface PatientClinicalRecordProps {
  patient: Patient;
  initialTab?: 'summary' | 'caja';
  onUpdatePatient: (id: string, updates: Partial<Patient>) => void;
  onUpdateMedicalFlags: (flags: Partial<MedicalFlags>) => void;
  onAddTreatment: (treatment: Omit<Treatment, 'id' | 'date' | 'time'>) => void;
  onUpdateTreatment: (id: string, updates: Partial<Treatment>) => void;
  onDeleteTreatment: (id: string) => void;
  onAddNote: (text: string) => void;
  onDeleteNote: (id: string) => void;
  onAddImage: (patientId: string, url: string, label: string) => void;
  onDeleteImage: (id: string) => void;
  onAddAdvancePayment: (amount: number, currency: 'PEN' | 'USD', description: string, notes?: string, type?: 'Cargo' | 'Abono', items?: ReceiptItem[]) => void;
  onUpdateAdvancePayment: (id: string, updates: Partial<AdvancePayment>) => void;
  onDeleteAdvancePayment: (id: string) => void;
  currentUser: User;
}

const parseDateToComparable = (dateStr?: string): string => {
  if (!dateStr) return '0000-00-00';
  const trimmed = dateStr.trim();
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  
  const slashParts = trimmed.split('/');
  if (slashParts.length === 3) {
    const day = slashParts[0].padStart(2, '0');
    const month = slashParts[1].padStart(2, '0');
    const year = slashParts[2];
    if (year.length === 4) {
      return `${year}-${month}-${day}`;
    }
  }
  
  const dashParts = trimmed.split('-');
  if (dashParts.length === 3 && dashParts[2].length === 4) {
    const day = dashParts[0].padStart(2, '0');
    const month = dashParts[1].padStart(2, '0');
    const year = dashParts[2];
    return `${year}-${month}-${day}`;
  }
  
  return trimmed;
};

const timeToMinutes = (timeStr?: string): number => {
  if (!timeStr) return 0;
  const trimmed = timeStr.trim().toUpperCase();
  
  const isPM = trimmed.includes('PM');
  const isAM = trimmed.includes('AM');
  const cleanTime = trimmed.replace('PM', '').replace('AM', '').trim();
  
  const parts = cleanTime.split(':');
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (!isNaN(hours) && !isNaN(minutes)) {
      if (isPM && hours < 12) {
        hours += 12;
      } else if (isAM && hours === 12) {
        hours = 0;
      }
      return hours * 60 + minutes;
    }
  }
  return 0;
};

const PatientClinicalRecord: React.FC<PatientClinicalRecordProps> = ({ 
  patient, initialTab, onUpdatePatient, onUpdateMedicalFlags, onAddNote, onAddImage, onDeleteImage, onAddAdvancePayment, onDeleteAdvancePayment, currentUser
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'caja'>(initialTab || 'summary');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isOptimizingImage, setIsOptimizingImage] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewRotation, setPreviewRotation] = useState(0);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const [isHighContrastText, setIsHighContrastText] = useState(false);
  const [galleryViewMode, setGalleryViewMode] = useState<'hd' | 'grid'>('hd');
  const [isDraggingPreview, setIsDraggingPreview] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const openImagePreview = (url: string) => {
    setPreviewImage(url);
    setPreviewZoom(1);
    setPreviewRotation(0);
    setPreviewPosition({ x: 0, y: 0 });
    setIsHighContrastText(false);
  };

  const handleDownloadOriginal = async (targetUrl?: string | null, labelToUse?: string) => {
    const url = targetUrl || previewImage;
    if (!url) return;
    try {
      if (url.startsWith('http')) {
        const res = await fetch(url);
        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        const cleanName = (labelToUse || patient.name || 'Paciente').replace(/\s+/g, '_');
        const extMatch = url.match(/\.(png|jpe?g|webp|gif|bmp)(\?.*)?$/i);
        const ext = extMatch ? extMatch[1] : 'jpg';
        a.download = `Clinica_SM_${cleanName}_${Date.now()}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
        return;
      }
    } catch (e) {
      console.error("Blob download failed, using direct link fallback", e);
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = `Clinica_${(patient.name || 'Paciente').replace(/\s+/g, '_')}_${Date.now()}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && previewImage) {
        setPreviewImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImage]);
  const [authDeleteId, setAuthDeleteId] = useState<{ id: string, type: 'image' | 'caja' | 'medHistory' | 'clinicalNote' } | null>(null);
  const [authKey, setAuthKey] = useState('');
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [showCajaModal, setShowCajaModal] = useState(false);
  const [cajaType, setCajaType] = useState<'Cargo' | 'Abono'>('Abono');
  const [cajaAmount, setCajaAmount] = useState('');
  const [cajaCurrency, setCajaCurrency] = useState<'PEN' | 'USD'>('PEN');
  const [cajaConcept, setCajaConcept] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [medHistoryInput, setMedHistoryInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const [cajaPage, setCajaPage] = useState(1);

  useEffect(() => {
    setCajaPage(1);
  }, [patient.id]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const itemsPerPage = 10;
  const sortedCajaList = useMemo(() => {
    const list = [...(patient.advancePayments || [])];
    list.sort((a, b) => {
      const dateA = parseDateToComparable(a.date);
      const dateB = parseDateToComparable(b.date);
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }
      const minutesA = timeToMinutes(a.time);
      const minutesB = timeToMinutes(b.time);
      return minutesB - minutesA;
    });
    return list;
  }, [patient.advancePayments]);

  const paginatedCajaList = useMemo(() => {
    const list = sortedCajaList;
    const startIndex = (cajaPage - 1) * itemsPerPage;
    return list.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedCajaList, cajaPage]);

  const totalCajaPages = useMemo(() => {
    return Math.ceil(sortedCajaList.length / itemsPerPage) || 1;
  }, [sortedCajaList]);

  const formatTo12Hour = (timeStr?: string): string => {
    if (!timeStr) return '--:--';
    const trimmed = timeStr.trim().toUpperCase();
    
    const isPM = trimmed.includes('PM');
    const isAM = trimmed.includes('AM');
    const cleanTime = trimmed.replace('PM', '').replace('AM', '').trim();
    
    const parts = cleanTime.split(':');
    if (parts.length >= 2) {
      let hours = parseInt(parts[0], 10);
      const minutes = parts[1].padStart(2, '0');
      if (!isNaN(hours)) {
        let finalAMPM = 'AM';
        if (isPM) {
          finalAMPM = 'PM';
        } else if (isAM) {
          finalAMPM = 'AM';
        } else {
          finalAMPM = hours >= 12 ? 'PM' : 'AM';
        }
        
        hours = hours % 12;
        if (hours === 0) hours = 12;
        const hoursStr = hours.toString().padStart(2, '0');
        return `${hoursStr}:${minutes} ${finalAMPM}`;
      }
    }
    return trimmed;
  };

  const getCajaRowItems = (p: any): { description: string; priceStr?: string }[] => {
    if (p.items && p.items.length > 0) {
      return p.items.map((item: any) => ({
        description: item.description,
        priceStr: `(${p.currency === 'USD' ? '$' : 'S/'}${item.unitPrice.toFixed(2)})`
      }));
    }
    
    if (!p.description) return [];
    
    const parts = p.description.split(',');
    let explicitPricesCount = 0;
    
    const parsedParts = parts.map((part: string) => {
      const trimmed = part.trim();
      const match = trimmed.match(/\(([^)]+)\)/);
      if (match) {
        const priceVal = match[1].trim();
        let descVal = trimmed.replace(/\(([^)]+)\)/, '').trim();
        if (!descVal) descVal = trimmed;
        
        const formattedPrice = priceVal.includes('$') || priceVal.includes('S/') 
          ? priceVal 
          : `${p.currency === 'USD' ? '$' : 'S/'}${priceVal}`;
          
        explicitPricesCount++;
        return {
          description: descVal,
          priceStr: `(${formattedPrice})`
        };
      }
      
      const trailingPriceRegex = /(?:S\/\.?\s*|\$\s*)?(\d+(?:\.\d+)?)\s*$/i;
      const priceMatch = trimmed.match(trailingPriceRegex);
      if (priceMatch) {
        const priceVal = priceMatch[0].trim();
        let descVal = trimmed.replace(trailingPriceRegex, '').trim();
        if (!descVal) descVal = trimmed;
        
        const formattedPrice = priceVal.includes('$') || priceVal.includes('S/') 
          ? priceVal 
          : `${p.currency === 'USD' ? '$' : 'S/'}${priceVal}`;
          
        explicitPricesCount++;
        return {
          description: descVal,
          priceStr: `(${formattedPrice})`
        };
      }
      
      return {
        description: trimmed,
        priceStr: undefined
      };
    });
    
    return parsedParts.map((item: any) => {
      if (item.priceStr) return item;
      if (p.amount) {
        const itemPrice = explicitPricesCount === 0 ? (p.amount / parts.length) : 0;
        if (itemPrice > 0) {
          return {
            description: item.description,
            priceStr: `(${p.currency === 'USD' ? '$' : 'S/'}${itemPrice.toFixed(2)})`
          };
        }
      }
      return item;
    });
  };

  const [currentReceiptItems, setCurrentReceiptItems] = useState<ReceiptItem[]>([]);
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemUnitPrice, setNewItemUnitPrice] = useState('');

  const descriptionInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);

  const medicalFlagItems = [
    { key: 'heartProblems', label: 'P.CARDIATICOS' }, { key: 'coagulation', label: 'COAGULACIÓN' }, { key: 'asthma', label: 'ASMA' },
    { key: 'hypertension', label: 'HIPERTENSIÓN' }, { key: 'diabetes', label: 'DIABETES' }, { key: 'epilepsy', label: 'EPILEPSIA' },
    { key: 'pregnancy', label: 'EMBARAZO' }, { key: 'allergies', label: 'ALERGIAS' }, { key: 'anemia', label: 'ANEMIA' },
  ];

  const balances = useMemo(() => {
    let penAbonos = 0, usdAbonos = 0, penCargos = 0, usdCargos = 0;
    patient.advancePayments?.forEach(p => {
      const amt = p.amount || 0;
      const type = p.type?.toLowerCase();
      if (p.currency === 'USD') { if (type === 'abono') usdAbonos += amt; else usdCargos += amt; }
      else { if (type === 'abono') penAbonos += amt; else penCargos += amt; }
    });
    return { pen: penCargos - penAbonos, usd: usdCargos - usdAbonos };
  }, [patient]);

  const calculatedTotal = useMemo(() => {
    return currentReceiptItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  }, [currentReceiptItems]);

  useEffect(() => {
    if (cajaType === 'Cargo') {
      setCajaAmount(calculatedTotal.toFixed(2));
    }
  }, [calculatedTotal, cajaType]);

  const renderBalance = (val: number, symbol: string) => {
    if (val > 0) return <span className="text-rose-500 font-black">-{symbol}{(val || 0).toLocaleString()}</span>;
    if (val < 0) return <span className="text-emerald-400 font-black">{symbol}0</span>;
    return <span className="text-slate-500 font-black">{symbol}0</span>;
  };

  const recognitionRef = useRef<any>(null);

  const handleVoiceRecord = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("API de reconocimiento de voz no disponible en este navegador");
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-ES';
      recognition.continuous = true;
      recognition.interimResults = true;

      const initialText = noteInput ? noteInput + (noteInput.endsWith(' ') ? '' : ' ') : '';

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        let finalStr = '';
        let interimStr = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalStr += event.results[i][0].transcript;
          } else {
            interimStr += event.results[i][0].transcript;
          }
        }
        setNoteInput(initialText + finalStr + interimStr);
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Error al iniciar grabación de voz:", err);
      setIsRecording(false);
    }
  };

  const downloadCargoWord = (p: AdvancePayment) => {
    const total = p.amount || 0;
    const currencySign = p.currency === 'USD' ? '$' : 'S/';

    let itemsRows = '';
    
    if (p.items && p.items.length > 0) {
      itemsRows = p.items.map(item => `
          <tr>
            <td style='padding: 12px; border: 1px solid #e2e8f0; font-size: 11pt; color: #1e293b;'>${item.description.toUpperCase()}</td>
            <td style='padding: 12px; border: 1px solid #e2e8f0; font-size: 11pt; text-align: right; font-weight: bold; color: #1e293b;'>${currencySign}${item.unitPrice.toFixed(2)}</td>
          </tr>
        `).join('');
    } else {
      const descriptions = p.description.split(',').map(d => d.trim()).filter(d => d);
      if (descriptions.length > 1) {
        itemsRows = descriptions.map((desc, idx) => `
          <tr>
            <td style='padding: 12px; border: 1px solid #e2e8f0; font-size: 11pt; color: #1e293b;'>${desc.toUpperCase()}</td>
            <td style='padding: 12px; border: 1px solid #e2e8f0; font-size: 11pt; text-align: right; font-weight: bold; color: #1e293b;'>${idx === descriptions.length - 1 ? currencySign + total.toFixed(2) : currencySign + '0.00'}</td>
          </tr>
        `).join('');
      } else {
        itemsRows = `
          <tr>
            <td style='padding: 12px; border: 1px solid #e2e8f0; font-size: 11pt; color: #1e293b;'>${p.description.toUpperCase()}</td>
            <td style='padding: 12px; border: 1px solid #e2e8f0; font-size: 11pt; text-align: right; font-weight: bold; color: #1e293b;'>${currencySign}${total.toFixed(2)}</td>
          </tr>
        `;
      }
    }

    const content = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Boleta de Pago</title>
      <style>
        body { font-family: 'Calibri', 'Arial', sans-serif; color: #333; margin: 0; padding: 0; }
        .container { padding: 40px; }
        .header-container { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .clinic-info { width: 55%; vertical-align: top; font-size: 10pt; color: #64748b; line-height: 1.4; }
        .logo-section { width: 45%; text-align: right; vertical-align: top; }
        .clinic-name { color: #1a5eb0; font-size: 22pt; font-weight: bold; margin: 0; text-transform: uppercase; }
        .ruc { color: #f9b115; font-size: 10pt; font-weight: bold; margin-top: 5px; }
        .divider { border: 0; border-top: 2px solid #f1f5f9; margin: 30px 0; }
        .client-section { margin-bottom: 40px; font-size: 11pt; }
        .info-table { width: 100%; border-collapse: collapse; }
        .label { font-weight: bold; color: #64748b; font-size: 9pt; text-transform: uppercase; margin-bottom: 4px; }
        .value { font-weight: bold; color: #0f172a; font-size: 12pt; }
        .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border-radius: 12px; overflow: hidden; }
        .invoice-table th { background-color: #0f172a; color: #ffffff; padding: 14px; text-align: left; font-size: 10pt; text-transform: uppercase; letter-spacing: 0.1em; }
        .totals-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .totals-label { width: 75%; text-align: right; padding: 12px 20px; font-size: 12pt; font-weight: bold; color: #64748b; }
        .totals-value { width: 25%; text-align: right; padding: 12px; font-size: 18pt; font-weight: 900; color: #1a5eb0; background-color: #f8fafc; border: 2px solid #e2e8f0; }
        .footer { margin-top: 100px; text-align: center; color: #94a3b8; font-size: 8pt; border-top: 1px solid #f1f5f9; padding-top: 20px; }
      </style>
      </head>
      <body>
        <div class='container'>
          <table class='header-container'>
            <tr>
              <td class='clinic-info'>
                <p style='font-size: 12pt; font-weight: bold; color: #334155;'>DIRECCIÓN PRINCIPAL:</p>
                <p>Av. José de la Riva Agüero 406A</p>
                <p>San Miguel, Lima - Perú</p>
                <p style='margin-top: 10px; font-weight: bold;'>CENTRAL TELEFÓNICA:</p>
                <p>Cel : 947913346</p>
              </td>
              <td class='logo-section'>
                <p class='clinic-name'>CLÍNICA DENTAL<br>SAN MIGUEL</p>
                <p class='ruc'>RUC: 20602142427</p>
                <p style='font-size: 8pt; color: #f9b115; font-weight: 800; letter-spacing: 0.2em;'>ODONTOLOGÍA INTEGRAL</p>
              </td>
            </tr>
          </table>

          <div class='divider'></div>

          <div class='client-section'>
            <table class='info-table'>
              <tr>
                <td style='width: 60%; vertical-align: top;'>
                  <div class='label'>PACIENTE / CLIENTE:</div>
                  <div class='value'>${patient.name.toUpperCase()}</div>
                  <div style='margin-top: 15px;' class='label'>DNI / RUC:</div>
                  <div class='value'>${patient.dni || '---'}</div>
                </td>
                <td style='width: 40%; vertical-align: top; text-align: right;'>
                  <div class='label'>FECHA DE EMISIÓN:</div>
                  <div class='value'>${p.date}</div>
                  <div style='margin-top: 15px;' class='label'>TIPO DE COMPROBANTE:</div>
                  <div class='value' style='color: #ef4444;'>BOLETA DE PAGO</div>
                </td>
              </tr>
            </table>
          </div>

          <table class='invoice-table'>
            <thead>
              <tr>
                <th style='width: 75%;'>Descripción del Servicio</th>
                <th style='width: 25%; text-align: right;'>Importe (${p.currency})</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <table class='totals-table'>
            <tr>
              <td class='totals-label'>TOTAL A PAGAR</td>
              <td class='totals-value'>${currencySign}${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            </tr>
          </table>

          <div class='footer'>
            <p>Gracias por confiar su salud dental en nosotros.</p>
            <p>Este documento es un comprobante de control interno emitido electrónicamente.</p>
            <p style='margin-top: 5px;'>© 2024 Clínica Dental San Miguel - Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BOLETA_SM_${patient.dni || '000'}_${p.date.replace(/\//g, '-')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadProfessionalWord = () => {
    const today = new Date().toLocaleDateString();
    const flags = medicalFlagItems
      .filter(item => (patient.medicalFlags as any)?.[item.key])
      .map(item => item.label)
      .join(', ') || 'NINGUNO';

    const historyHtml = (patient.medicalHistory || []).map(h => `<li>[${h.date}] ${h.text} (${h.author})</li>`).join('');
    const evolutionHtml = (patient.clinicalNotes || []).map(n => `<li>[${n.date} ${n.time}] ${n.text} - Dr(a). ${n.author}</li>`).join('');
    
    const galleryHtml = (patient.images || []).map(img => `
      <div style='display: inline-block; width: 45%; margin: 5px; text-align: center; border: 1px solid #ddd; padding: 5px;'>
        <img src='${img.url}' width='250' style='display: block; margin: 0 auto;' />
        <p style='font-size: 8pt; color: #666; margin-top: 5px;'>${img.date} - ${img.label}</p>
      </div>
    `).join('');

    const content = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Ficha Clínica</title>
      <style>
        body { font-family: 'Calibri', 'Arial', sans-serif; color: #1e293b; }
        .header { text-align: center; border-bottom: 3px solid #3858fa; padding-bottom: 15px; margin-bottom: 30px; }
        .title { color: #1a5eb0; font-size: 22pt; font-weight: bold; margin: 0; }
        .subtitle { color: #f9b115; font-size: 10pt; font-weight: bold; text-transform: uppercase; margin: 5px 0; }
        .patient-card { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .section-title { background-color: #3858fa; color: white; padding: 8px 15px; font-weight: bold; font-size: 12pt; border-radius: 5px; margin: 25px 0 10px 0; text-transform: uppercase; }
        .data-grid { width: 100%; }
        .label { font-weight: bold; color: #64748b; font-size: 9pt; text-transform: uppercase; }
        .value { font-weight: bold; font-size: 11pt; }
        ul { padding-left: 20px; }
        li { margin-bottom: 8px; font-size: 10pt; line-height: 1.4; }
      </style>
      </head>
      <body>
        <div class='header'>
          <p class='title'>CLÍNICA DENTAL SAN MIGUEL</p>
          <p class='subtitle'>Odontología Integral Especializada</p>
          <p style='font-size: 8pt; color: #94a3b8;'>Documento generado el: ${today}</p>
        </div>

        <div class='patient-card'>
          <h2 style='margin-top:0;'>EXPEDIENTE CLÍNICO: ${patient.name.toUpperCase()}</h2>
          <table class='data-grid'>
            <tr>
              <td width='33%'><span class='label'>DNI:</span><br/><span class='value'>${patient.dni || '---'}</span></td>
              <td width='33%'><span class='label'>EDAD:</span><br/><span class='value'>${patient.age} AÑOS</span></td>
              <td width='33%'><span class='label'>CELULAR:</span><br/><span class='value'>${patient.phone || '---'}</span></td>
            </tr>
          </table>
        </div>

        <div class='section-title'>Antecedentes Médicos</div>
        <p><b>Alertas Clíninas:</b> ${flags}</p>
        <ul>${historyHtml || '<li>Sin comentarios de antecedentes.</li>'}</ul>

        <div class='section-title'>Evolución y Notas de Sesión</div>
        <ul>${evolutionHtml || '<li>No se registran notas de evolución.</li>'}</ul>

        <div class='section-title'>Galería Clínica y Evidencia Visual</div>
        <div style='text-align: center;'>
           ${galleryHtml || '<p>No se registran imágenes en este expediente.</p>'}
        </div>
        
        <div style='margin-top: 50px; text-align: center; border-top: 1px solid #cbd5e1; padding-top: 10px; width: 250px; margin-left: auto; margin-right: auto;'>
          <p style='font-size: 9pt;'>Firma del Profesional</p>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FICHA_SM_${patient.name.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImageInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setIsOptimizingImage(true);
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          // Procesa a 4096px (4K Ultra HD) preservando bordes finos, etiquetas, manuscritos y lotes (Backblaze B2)
          const result = await optimizeClinicalImage(file, 4096, 0.96);
          const rawName = file.name ? file.name.replace(/\.[^/.]+$/, '').trim() : '';
          const label = rawName ? rawName.substring(0, 30) : 'Captura HD';
          onAddImage(patient.id, result.dataUrl, label);
        }
      } catch (err: any) {
        console.error("Error optimizando imagen clínica:", err);
        alert("Hubo un problema al procesar la imagen: " + (err.message || 'Error desconocido'));
      } finally {
        setIsOptimizingImage(false);
      }
    }
    if (e.target) e.target.value = '';
  };

  const handleAddMedHistoryNote = () => {
    if (!medHistoryInput.trim()) return;
    const newNote: ClinicalNote = { id: Math.random().toString(36).substr(2, 9), date: new Date().toLocaleDateString(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), text: medHistoryInput.trim(), author: currentUser.name };
    onUpdatePatient(patient.id, { medicalHistory: [newNote, ...(patient.medicalHistory || [])] });
    setMedHistoryInput('');
  };

  const confirmDeleteAction = () => {
    // NUEVA CLAVE UNIFICADA PARA REGISTROS CLÍNICOS: 1717
    const requiredKey = '1717';

    if (authKey === requiredKey) {
      if (authDeleteId?.type === 'image') onDeleteImage(authDeleteId.id);
      if (authDeleteId?.type === 'caja') onDeleteAdvancePayment(authDeleteId.id);
      if (authDeleteId?.type === 'medHistory') onUpdatePatient(patient.id, { medicalHistory: (patient.medicalHistory || []).filter(n => n.id !== authDeleteId.id) });
      if (authDeleteId?.type === 'clinicalNote') onUpdatePatient(patient.id, { clinicalNotes: (patient.clinicalNotes || []).filter(n => n.id !== authDeleteId.id) });
      setAuthDeleteId(null); setAuthKey('');
    } else {
      alert("Clave incorrecta.");
    }
  };

  const handleAddItem = () => {
    const price = parseFloat(newItemUnitPrice);
    
    if (newItemDescription.trim() && !isNaN(price) && price >= 0) {
      setCurrentReceiptItems([...currentReceiptItems, { description: newItemDescription.trim(), quantity: 1, unitPrice: price }]);
      setNewItemDescription('');
      setNewItemUnitPrice('');
      if(descriptionInputRef.current) descriptionInputRef.current.focus();
    } else {
      alert("Por favor ingrese descripción y monto válidos.");
    }
  };

  const handleRemoveItem = (index: number) => {
    const updated = [...currentReceiptItems];
    updated.splice(index, 1);
    setCurrentReceiptItems(updated);
  };

  const handleConfirmCaja = () => {
    let finalAmount = 0;
    let finalItems: ReceiptItem[] | undefined = undefined;

    if (cajaType === 'Cargo') {
      if (currentReceiptItems.length === 0) {
        alert("Debe agregar al menos un ítem para registrar un cargo.");
        return;
      }
      finalAmount = calculatedTotal;
      finalItems = currentReceiptItems;
    } else {
      finalAmount = parseFloat(cajaAmount);
      if (isNaN(finalAmount) || finalAmount <= 0) {
        alert("Monto de abono inválido.");
        return;
      }
      if (!cajaConcept.trim()) {
        alert("Ingrese el concepto o descripción del abono.");
        return;
      }
    }

    const finalDescription = cajaType === 'Cargo' 
      ? currentReceiptItems.map(i => i.description).join(', ') 
      : cajaConcept.trim();

    onAddAdvancePayment(finalAmount, cajaCurrency, finalDescription, '', cajaType, finalItems);
    setShowCajaModal(false);
    setCajaAmount(''); 
    setCajaConcept('');
    setCurrentReceiptItems([]);
    setNewItemDescription('');
    setNewItemUnitPrice('');
  };

  return (
    <div className="flex flex-col lg:flex-row gap-2 p-2 h-full bg-[#0b1120] text-slate-100 overflow-hidden animate-in fade-in duration-500">
      <aside className="w-full lg:w-[240px] shrink-0 flex flex-col gap-2 overflow-y-auto scrollbar-hide lg:border-r lg:border-slate-800/60 lg:pr-2">
        <div className="bg-[#111827] rounded-[28px] p-4 border border-slate-800 flex flex-col items-center shadow-2xl">
          <div className="relative mb-4 flex flex-col items-center">
            <div className="size-20 lg:size-24 rounded-[24px] overflow-hidden border-2 border-slate-800 shadow-xl transition-all hover:scale-105">
              <img src={patient.photo} className="size-full object-cover" alt={patient.name} />
            </div>
            <div className="absolute -bottom-1 -right-1 size-4 bg-emerald-500 border-2 border-[#111827] rounded-full"></div>
          </div>
          <h1 className="text-[15px] lg:text-[17px] font-black text-white uppercase text-center mb-1 leading-tight">{patient.name}</h1>
          <p className="mb-4"></p> {/* Espaciador para reemplazar el ID visualmente */}
          
          <nav className="w-full flex lg:flex-col gap-2 mb-4">
            <button onClick={() => setActiveTab('summary')} className={`flex-1 flex items-center justify-center lg:justify-start gap-2 px-4 py-3 rounded-[14px] text-[10px] font-black transition-all ${activeTab === 'summary' ? 'bg-[#3858fa] text-white shadow-lg' : 'text-slate-400 bg-slate-800/30 hover:bg-slate-800/50'}`}><span className="material-symbols-outlined text-base">analytics</span> RESUMEN</button>
            <button onClick={() => setActiveTab('caja')} className={`flex-1 flex items-center justify-center lg:justify-start gap-2 px-4 py-3 rounded-[14px] text-[10px] font-black transition-all ${activeTab === 'caja' ? 'bg-[#10b981] text-white shadow-lg' : 'text-slate-400 bg-slate-800/30 hover:bg-slate-800/50'}`}><span className="material-symbols-outlined text-base">payments</span> CAJA</button>
          </nav>

          <div className="hidden lg:flex w-full flex-col space-y-4 py-4 border-t border-slate-800/60">
             <div className="flex items-center gap-3">
                <div className="size-7 bg-slate-800 rounded-lg flex items-center justify-center text-slate-500"><span className="material-symbols-outlined text-sm">badge</span></div>
                <div className="flex flex-col"><span className="text-[6px] font-black text-slate-500 uppercase tracking-widest leading-none mb-0.5">DNI</span><span className="text-white text-[10px] font-black">{patient.dni || '---'}</span></div>
             </div>
             <div className="flex items-center gap-3">
                <div className="size-7 bg-slate-800 rounded-lg flex items-center justify-center text-slate-500"><span className="material-symbols-outlined text-sm">cake</span></div>
                <div className="flex flex-col"><span className="text-[6px] font-black text-slate-500 uppercase tracking-widest leading-none mb-0.5">EDAD / GÉNERO</span><span className="text-white text-[10px] font-black">{patient.age} AÑOS • {patient.gender === 'Male' ? 'MASC' : 'FEM'}</span></div>
             </div>
             <div className="flex items-center gap-3">
                <div className="size-7 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500"><span className="material-symbols-outlined text-sm">call</span></div>
                <div className="flex flex-col"><span className="text-[6px] font-black text-slate-500 uppercase tracking-widest leading-none mb-0.5">CELULAR</span><span className="text-emerald-400 text-[10px] font-black">{patient.phone || '---'}</span></div>
             </div>
             <div className="flex items-center gap-3">
                <div className="size-7 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-500"><span className="material-symbols-outlined text-sm">mail</span></div>
                <div className="flex flex-col"><span className="text-[6px] font-black text-slate-500 uppercase tracking-widest leading-none mb-0.5">CORREO</span><span className="text-white text-[9px] font-black truncate max-w-[120px]">{patient.email || '---'}</span></div>
             </div>
             <div className="pt-2 flex flex-col gap-1.5 bg-slate-900/30 p-3 rounded-2xl border border-slate-800/40">
                <div className="flex justify-between items-center"><span className="text-[6px] font-black text-slate-500 tracking-widest">DEUDA S/</span>{renderBalance(balances.pen, 'S/')}</div>
                <div className="flex justify-between items-center"><span className="text-[6px] font-black text-slate-500 tracking-widest">DEUDA $</span>{renderBalance(balances.usd, '$')}</div>
             </div>
          </div>

          <div className="w-full pt-4 border-t border-slate-800/60 lg:mt-4">
            <button 
              onClick={downloadProfessionalWord}
              className="w-full h-11 bg-white/5 border border-white/10 text-white rounded-2xl font-black text-[8px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white hover:text-slate-900 transition-all shadow-xl active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">description</span>
              DESCARGAR HISTORIA (WORD)
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 space-y-2 overflow-y-auto scrollbar-hide pb-20 px-2 lg:px-4">
        {activeTab === 'summary' && (
          <div className="space-y-4 lg:space-y-6 animate-in slide-in-from-right-2 duration-300">
            <div className="bg-[#111827] p-5 rounded-[28px] border border-slate-800 shadow-xl">
              <h2 className="text-[9px] font-black text-white tracking-[0.2em] uppercase mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-rose-500 text-lg">medical_services</span> ANTECEDENTES MÉDICOS</h2>
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2 mb-4">
                {medicalFlagItems.map(item => {
                  const active = (patient.medicalFlags as any)?.[item.key];
                  return (
                    <button key={item.key} onClick={() => onUpdateMedicalFlags({ [item.key]: !active })} className={`flex flex-col items-center justify-center p-2.5 rounded-[14px] border transition-all text-[7px] font-black ${active ? 'bg-white border-white text-slate-900 shadow-xl scale-105' : 'bg-[#1e293b]/30 border-slate-800 text-slate-500'}`}>
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <div className="bg-[#0f172a] rounded-[22px] border border-blue-500/40 p-5">
                <div className="flex gap-2 mb-4">
                  <input type="text" placeholder="Agregar comentario crucial..." className="flex-1 bg-slate-900 border-none rounded-xl px-4 text-xs font-bold text-white focus:ring-2 ring-primary/20 shadow-inner h-10" value={medHistoryInput} onChange={e => setMedHistoryInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddMedHistoryNote()} />
                  <button onClick={handleAddMedHistoryNote} className="bg-primary text-white px-4 rounded-xl font-black text-[9px] uppercase shadow-lg active:scale-95 transition-all">AGREGAR</button>
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-hide pr-1">
                  {(patient.medicalHistory || []).map(note => (
                    <div key={note.id} className="p-3 bg-[#111827] rounded-xl border border-slate-800 group transition-all hover:border-primary/20 shadow-sm">
                      <div className="flex justify-between items-center mb-1 text-[7px] font-black text-slate-500 uppercase"><span>{note.date} • {note.time}</span><button onClick={() => setAuthDeleteId({id: note.id, type: 'medHistory'})} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition-colors"><span className="material-symbols-outlined text-sm">delete</span></button></div>
                      <p className="text-[12px] font-bold text-white italic leading-tight">"{note.text}"</p>
                      <p className="text-[6px] font-black text-primary uppercase mt-1 tracking-widest">DR(A). {note.author.toUpperCase()}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-[#111827] p-5 rounded-[28px] border border-slate-800 shadow-xl">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
                <div className="flex items-center gap-3">
                  <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-xl">photo_library</span> GALERÍA CLÍNICA
                  </h3>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => cameraInputRef.current?.click()} 
                    disabled={isOptimizingImage}
                    className="h-10 px-5 bg-emerald-600 disabled:bg-slate-700 text-white rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-500 shadow-xl transition-all active:scale-95 cursor-pointer shrink-0"
                  >
                    {isOptimizingImage ? (
                      <>
                        <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                        PROCESANDO...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-lg">add_a_photo</span>
                        SUBIR FOTO
                      </>
                    )}
                  </button>
                  <input type="file" ref={cameraInputRef} onChange={handleImageInput} accept="image/*" multiple className="hidden" />
                </div>
              </div>

              {/* Contenedor de imágenes */}
              {(!patient.images || patient.images.length === 0) ? (
                <div 
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full p-8 border-2 border-dashed border-slate-800 hover:border-primary/50 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-slate-900/30 hover:bg-slate-900/60 group"
                >
                  <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-2xl">add_photo_alternate</span>
                  </div>
                  <h4 className="text-xs font-black text-white uppercase tracking-tight mb-0.5">Sin fotos clínicas</h4>
                  <p className="text-[10px] text-slate-500 font-medium">Presione aquí para agregar imágenes</p>
                </div>
              ) : galleryViewMode === 'hd' ? (
                /* MODO HD DIARIO: Tarjetas grandes de alta definición para consulta y diagnóstico inmediato */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {patient.images.map((img, idx) => (
                    <div 
                      key={img.id} 
                      className="group relative rounded-2xl overflow-hidden border border-slate-800 bg-[#0f172a] hover:border-primary/60 transition-all shadow-xl flex flex-col"
                    >
                      {/* Vista de imagen HD con clic directo para ampliar */}
                      <div 
                        onClick={() => openImagePreview(img.url)}
                        className="relative h-60 w-full bg-slate-950/80 overflow-hidden cursor-pointer flex items-center justify-center group/img"
                        title="Clic para ver en visor"
                      >
                        <img 
                          src={img.url} 
                          className="size-full object-contain p-2 transition-transform duration-300 group-hover/img:scale-105" 
                          alt={img.label || 'Captura Clínica'} 
                          loading="lazy" 
                        />
                        
                        {/* Overlay hover con indicación visual */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[1px]">
                          <span className="px-3 py-1.5 bg-white text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-2xl">
                            <span className="material-symbols-outlined text-sm">zoom_in</span>
                            AMPLIAR
                          </span>
                        </div>

                        {/* Número de foto */}
                        <div className="absolute top-2.5 left-2.5">
                          <span className="px-2 py-0.5 rounded-lg text-[8px] font-black bg-black/70 text-slate-300 border border-white/10 uppercase tracking-widest backdrop-blur-md">
                            FOTO #{idx + 1}
                          </span>
                        </div>
                      </div>

                      {/* Pie de la tarjeta con fecha, descripción y acciones */}
                      <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-black text-white uppercase truncate tracking-tight">
                            {img.label || 'Imagen Clínica'}
                          </p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                            {img.date ? new Date(img.date).toLocaleDateString() : 'Fecha no especificada'}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleDownloadOriginal(img.url, img.label)}
                            className="size-8 bg-slate-800 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                            title="Descargar imagen original Backblaze"
                          >
                            <span className="material-symbols-outlined text-base">download</span>
                          </button>

                          <button
                            onClick={() => setAuthDeleteId({ id: img.id, type: 'image' })}
                            className="size-8 bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white rounded-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                            title="Eliminar foto (Requiere clave)"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* MODO MOSAICO COMPACTO */
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {patient.images.map(img => (
                    <div 
                      key={img.id} 
                      onClick={() => openImagePreview(img.url)}
                      className="group relative rounded-xl overflow-hidden border border-slate-800 aspect-square shadow-sm bg-slate-900 cursor-pointer hover:border-primary/50 transition-all"
                    >
                      <img 
                        src={img.url} 
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105" 
                        alt={img.label || 'Captura'} 
                        loading="lazy" 
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 p-1 transition-opacity">
                        <span className="size-7 bg-white text-slate-900 rounded-lg flex items-center justify-center shadow-md">
                          <span className="material-symbols-outlined text-base">zoom_in</span>
                        </span>
                      </div>
                      {img.label && (
                        <div className="absolute bottom-0 inset-x-0 bg-slate-950/90 px-1 py-0.5 truncate text-[7px] font-bold text-slate-300 pointer-events-none text-center">
                          {img.label}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#111827] p-5 rounded-[28px] border border-slate-800 shadow-xl">
              <h3 className="text-[9px] font-black text-white flex items-center gap-2 uppercase mb-4 tracking-[0.2em]"><span className="material-symbols-outlined text-amber-500 text-base">history_edu</span> EVOLUCIÓN</h3>
              <div className="bg-[#0f172a] p-1.5 rounded-[18px] border border-slate-800 flex flex-col sm:flex-row gap-2 mb-4 shadow-inner">
                <input type="text" placeholder="Escribir registro de hoy..." className="flex-1 bg-transparent border-none px-4 h-12 text-[11px] font-bold text-slate-200 focus:ring-0 placeholder:text-slate-600" value={noteInput} onChange={e => setNoteInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && noteInput.trim() && (onAddNote(noteInput), setNoteInput(''))} />
                <div className="flex gap-2 pr-1 p-1">
                  <button onClick={handleVoiceRecord} className={`size-10 rounded-xl flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400 hover:text-amber-500'}`} title="Dictado por voz"><span className="material-symbols-outlined text-xl">mic</span></button>
                  <button onClick={() => { if(noteInput.trim()){ onAddNote(noteInput); setNoteInput(''); } }} className="flex-1 sm:flex-none bg-[#3858fa] text-white px-6 h-10 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-xl active:scale-95 transition-all">GUARDAR</button>
                </div>
              </div>
              <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-hide pr-1">
                 {(patient.clinicalNotes || []).map(n => (
                   <div key={n.id} className="p-4 bg-[#0f172a] rounded-[24px] border border-slate-800/60 transition-all hover:border-primary/20 shadow-sm group">
                      <div className="flex justify-between items-center mb-2 px-0.5">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{n.date} • {n.time}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-black text-primary uppercase bg-primary/5 px-3 py-1 rounded-full border border-primary/10 tracking-tight">DR(A). {n.author.toUpperCase()}</span>
                          <button onClick={() => setAuthDeleteId({id: n.id, type: 'clinicalNote'})} className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-500 transition-all">
                             <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </div>
                      <p className="text-[12px] text-slate-200 font-bold leading-relaxed px-0.5 italic">"{n.text}"</p>
                   </div>
                 ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'caja' && (
          <div className="space-y-4 animate-in slide-in-from-right-2 duration-300">
             <div className="bg-[#111827] p-5 rounded-[28px] border border-slate-800 shadow-xl">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 px-1">
                   <h2 className="text-[13px] font-black text-white tracking-[0.2em] uppercase leading-none">HISTORIAL FINANCIERO</h2>
                   <button onClick={() => { setCajaType('Abono'); setShowCajaModal(true); }} className="w-full sm:w-auto bg-[#10b981] text-white px-6 py-3 rounded-xl font-black text-[10px] sm:text-[11px] uppercase tracking-widest shadow-lg active:scale-95 transition-all">+ NUEVO REGISTRO</button>
                 </div>
                 <div className="bg-[#0f172a] rounded-[22px] border border-slate-800 overflow-hidden overflow-x-auto shadow-inner scrollbar-hide">
                    <table className="w-full text-left min-w-[600px]">
                       <thead className="bg-[#1e293b]/50 border-b border-slate-800"><tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest"><th className="px-4 py-3">FECHA Y HORA</th><th className="px-4 py-3">CONCEPTO / AUTOR</th><th className="px-4 py-3 text-right">MONTO</th><th className="px-4 py-3 text-center">ACCIONES</th></tr></thead>
                       <tbody className="divide-y divide-slate-800">
                          {paginatedCajaList.map(p => (
                             <tr key={p.id} className={`transition-all hover:brightness-110 ${p.type?.toLowerCase() === 'cargo' ? 'bg-[#991b1b]/80 text-white' : 'bg-[#14532d]/80 text-white'}`}>
                                <td className="px-4 py-2.5">
                                  <p className="text-[11.5px] font-black">{p.date}</p>
                                  <p className="text-[9.5px] font-bold opacity-80 uppercase">{formatTo12Hour(p.time)}</p>
                                </td>
                                <td className="px-4 py-2">
                                  <div className="space-y-0.5 my-0.5">
                                    {getCajaRowItems(p).map((item, idx) => (
                                      <div key={idx} className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-tight text-white/95 leading-tight">
                                        <span className="size-1.5 bg-white/55 rounded-full shrink-0"></span>
                                        <span className="truncate max-w-[320px]">{item.description}</span>
                                        {item.priceStr && (
                                          <span className="text-[8.5px] bg-white/20 px-1 py-0.2 rounded text-white/90 font-black shrink-0 tracking-normal">{item.priceStr}</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  <p className="text-[8px] font-bold opacity-70 uppercase tracking-widest mt-0.5">@{p.author?.toLowerCase() || 'sistema'}</p>
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <p className="font-black text-[13.5px]">{p.type?.toLowerCase() === 'cargo' ? '-' : '+'}{p.currency === 'USD' ? '$' : 'S/'}{(p.amount || 0).toLocaleString()}</p>
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                   <div className="flex items-center justify-center gap-2">
                                     {p.type?.toLowerCase() === 'cargo' && (
                                       <button 
                                         onClick={() => downloadCargoWord(p)}
                                         className="size-8 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500 hover:text-white transition-all flex items-center justify-center shadow-sm"
                                         title="Descargar Boleta"
                                       >
                                          <span className="material-symbols-outlined text-[15px]">description</span>
                                       </button>
                                     )}
                                     <button onClick={() => setAuthDeleteId({id: p.id, type: 'caja'})} className="size-8 bg-black/20 text-white rounded-lg hover:bg-black/40 transition-all flex items-center justify-center shadow-sm" title="Anular Movimiento">
                                        <span className="material-symbols-outlined text-[15px]">delete</span>
                                     </button>
                                   </div>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                  </div>

                  {totalCajaPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between pt-4 px-1 border-t border-slate-800 mt-4 gap-4">
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                        PÁGINA {cajaPage} DE {totalCajaPages} ({patient.advancePayments?.length || 0} REGISTROS)
                      </p>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setCajaPage(prev => Math.max(1, prev - 1))}
                          disabled={cajaPage === 1}
                          className="h-9 px-4 rounded-lg bg-slate-800 text-slate-300 font-black text-[10.5px] uppercase tracking-widest hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">arrow_back</span>
                          ANT.
                        </button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalCajaPages }).map((_, idx) => {
                            const pageNum = idx + 1;
                            const isCurrent = pageNum === cajaPage;
                            return (
                              <button
                                key={pageNum}
                                onClick={() => setCajaPage(pageNum)}
                                className={`size-9 rounded-lg font-black text-[11px] transition-all ${
                                  isCurrent
                                    ? 'bg-[#e11d48] text-white font-black shadow-md'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => setCajaPage(prev => Math.min(totalCajaPages, prev + 1))}
                          disabled={cajaPage === totalCajaPages}
                          className="h-9 px-4 rounded-lg bg-slate-800 text-slate-300 font-black text-[10.5px] uppercase tracking-widest hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                        >
                          SIG.
                          <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </button>
                      </div>
                    </div>
                  )}
                 </div>
              </div>
        )}
      </main>

      {authDeleteId && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-xs rounded-[40px] p-8 flex flex-col items-center shadow-2xl border-4 border-white/20">
              <div className="size-16 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-2xl flex items-center justify-center mb-4 shadow-sm"><span className="material-symbols-outlined text-4xl">lock_person</span></div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase mb-6 tracking-widest text-center">Seguridad Clínica</h3>
              <input type="password" autoFocus className="w-full h-14 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-center text-3xl font-black tracking-[0.5em] mb-6 dark:text-white" value={authKey} onChange={e=>setAuthKey(e.target.value)} onKeyDown={e=>e.key==='Enter' && confirmDeleteAction()} placeholder="••" />
              <div className="flex gap-2 w-full">
                 <button onClick={() => {setAuthDeleteId(null); setAuthKey('');}} className="flex-1 h-12 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-black text-[9px] uppercase">CANCELAR</button>
                 <button onClick={confirmDeleteAction} className="flex-1 h-12 bg-red-600 text-white rounded-xl font-black text-[9px] uppercase shadow-lg active:scale-95 transition-all">CONFIRMAR</button>
              </div>
           </div>
        </div>
      )}

      {showCajaModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-4 lg:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
           <div className="bg-[#111827] w-full max-w-[95vw] lg:max-w-2xl max-h-[92vh] lg:max-h-[94vh] rounded-[24px] sm:rounded-[32px] border-2 sm:border-4 border-slate-800 p-3 sm:p-5 lg:p-6 shadow-2xl overflow-y-auto scrollbar-hide relative flex flex-col transition-all">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-primary/40 shrink-0"></div>
              <h3 className="text-[10px] sm:text-[11px] lg:text-[12px] font-black text-white uppercase text-center mb-2.5 sm:mb-4 lg:mb-4 tracking-widest shrink-0">NUEVO MOVIMIENTO DE CAJA</h3>
              
              <div className="space-y-2.5 sm:space-y-3.5 lg:space-y-4 flex-1">
                 <div className="flex gap-1.5 sm:gap-2 p-1 bg-slate-900 rounded-xl sm:rounded-2xl shadow-inner shrink-0">
                    <button onClick={() => {setCajaType('Abono'); setCajaConcept(''); setCurrentReceiptItems([]);}} className={`flex-1 h-8 sm:h-10 lg:h-10 rounded-lg sm:rounded-xl font-black text-[8px] sm:text-[10px] lg:text-[11px] uppercase transition-all ${cajaType === 'Abono' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Abono (Ingreso)</button>
                    <button onClick={() => {setCajaType('Cargo'); setCajaAmount(''); setCajaConcept('Boleta de Venta'); setCurrentReceiptItems([]);}} className={`flex-1 h-8 sm:h-10 lg:h-10 rounded-lg sm:rounded-xl font-black text-[8px] sm:text-[10px] lg:text-[11px] uppercase transition-all ${cajaType === 'Cargo' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Cargo (Deuda)</button>
                 </div>

                 <div className="space-y-2.5 sm:space-y-3.5 lg:space-y-4">
                    <div className="grid grid-cols-2 gap-2 sm:gap-3 shrink-0">
                        <div className="relative">
                           <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500">{cajaCurrency === 'USD' ? '$' : 'S/'}</span>
                           <input 
                             type="number" 
                             step="0.01" 
                             className="w-full h-9 sm:h-11 lg:h-12 bg-slate-900 border-none rounded-lg sm:rounded-xl pl-8 pr-2 text-center text-lg sm:text-xl lg:text-xl font-black text-white shadow-inner focus:ring-4 ring-primary/10 transition-all disabled:opacity-50" 
                             placeholder="0.00" 
                             value={cajaType === 'Cargo' ? calculatedTotal.toFixed(2) : cajaAmount} 
                             onChange={e=>setCajaAmount(e.target.value)} 
                             disabled={cajaType === 'Cargo'} 
                           />
                        </div>
                        <div className="relative">
                          <select className="w-full h-9 sm:h-11 lg:h-12 bg-slate-900 border-none rounded-lg sm:rounded-xl text-center text-[9px] sm:text-xs font-black text-white appearance-none shadow-inner focus:ring-4 ring-primary/10" value={cajaCurrency} onChange={e=>setCajaCurrency(e.target.value as any)}>
                            <option value="PEN">SOLES</option>
                            <option value="USD">DÓLARES</option>
                          </select>
                          <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none text-sm">expand_more</span>
                        </div>
                    </div>

                    {cajaType === 'Abono' ? (
                       <div className="space-y-1.5 animate-in slide-in-from-bottom-2 shrink-0">
                          <label className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Descripción / Concepto del Pago</label>
                          <input 
                            type="text" 
                            className="w-full h-9 sm:h-11 lg:h-12 bg-slate-900 border-none rounded-lg sm:rounded-xl px-4 text-[10px] sm:text-xs lg:text-xs font-black text-white shadow-inner focus:ring-4 ring-primary/10 transition-all placeholder:text-slate-700" 
                            placeholder="Ej: Pago de consulta o abono a cuenta..." 
                            value={cajaConcept} 
                            onChange={e=>setCajaConcept(e.target.value)} 
                          />
                       </div>
                    ) : (
                       <div className="space-y-2.5 sm:space-y-3.5 animate-in slide-in-from-bottom-4">
                          <div className="bg-slate-900 rounded-[18px] sm:rounded-[24px] p-3 sm:p-4 lg:p-5 space-y-2.5 sm:space-y-3.5 border border-slate-800 shadow-inner">
                             <div className="flex flex-col gap-2 items-stretch">
                                <div className="space-y-1">
                                   <label className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Descripción del Servicio</label>
                                   <input 
                                     type="text" 
                                     ref={descriptionInputRef}
                                     className="w-full h-8 sm:h-9 lg:h-10 bg-slate-800 border-none rounded-lg px-3 text-[10px] sm:text-[11px] font-bold text-white placeholder:text-slate-600 focus:ring-2 ring-primary/30 transition-all" 
                                     placeholder="Ej: Profilaxis, Resina..." 
                                     value={newItemDescription} 
                                     onChange={e=>setNewItemDescription(e.target.value)} 
                                   />
                                </div>
                                <div className="flex gap-2">
                                  <div className="flex-1 space-y-1">
                                    <label className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Monto</label>
                                    <div className="relative">
                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] sm:text-[10px] text-slate-500 font-bold">{cajaCurrency === 'USD' ? '$' : 'S/'}</span>
                                        <input 
                                          type="number" 
                                          step="0.01" 
                                          ref={priceInputRef}
                                          className="w-full h-8 sm:h-9 lg:h-10 bg-slate-800 border-none rounded-lg pl-7 pr-3 text-[10px] sm:text-[11px] font-bold text-white placeholder:text-slate-600 focus:ring-2 ring-primary/30 transition-all" 
                                          placeholder="0.00" 
                                          value={newItemUnitPrice} 
                                          onChange={e=>setNewItemUnitPrice(e.target.value)} 
                                          onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                                        />
                                    </div>
                                  </div>
                                  <div className="flex items-end">
                                    <button 
                                      type="button" 
                                      onClick={handleAddItem} 
                                      className="h-8 sm:h-9 lg:h-10 w-10 sm:w-12 bg-blue-600 text-white rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 hover:bg-blue-500 active:scale-90 transition-all shrink-0"
                                    >
                                      <span className="material-symbols-outlined text-lg sm:text-xl lg:text-2xl">add</span>
                                    </button>
                                  </div>
                                </div>
                             </div>

                             <div className="space-y-1.5">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                                   <h4 className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">VISTA PREVIA DE CARGOS</h4>
                                   <span className="text-[8px] sm:text-[9px] font-bold text-slate-600">{currentReceiptItems.length} ítems</span>
                                </div>
                                {currentReceiptItems.length > 0 ? (
                                   <div className="max-h-[80px] sm:max-h-24 lg:max-h-32 overflow-y-auto scrollbar-hide space-y-1 sm:space-y-1.5 pr-1">
                                      {currentReceiptItems.map((item, idx) => (
                                         <div key={idx} className="flex items-center gap-2 bg-slate-800/40 p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-slate-700/30 group animate-in slide-in-from-right-4">
                                            <div className="flex-1 min-w-0">
                                               <p className="text-[10px] sm:text-[11px] lg:text-[12px] font-black text-slate-100 truncate">{item.description}</p>
                                               <p className="text-[6px] sm:text-[7px] lg:text-[8px] font-bold text-slate-500 uppercase tracking-tight leading-none mt-0.5">Cargo Directo</p>
                                            </div>
                                            <div className="text-right">
                                               <p className="text-[10px] sm:text-[12px] lg:text-[13px] font-black text-white whitespace-nowrap">
                                                  {cajaCurrency === 'USD' ? '$' : 'S/'}{item.unitPrice.toFixed(2)}
                                               </p>
                                            </div>
                                            <button 
                                              onClick={() => handleRemoveItem(idx)}
                                              className="size-6 sm:size-7 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg flex items-center justify-center transition-all lg:opacity-0 lg:group-hover:opacity-100"
                                            >
                                               <span className="material-symbols-outlined text-xs sm:text-sm">close</span>
                                            </button>
                                         </div>
                                      ))}
                                   </div>
                                ) : (
                                   <div className="py-3 sm:py-5 lg:py-6 text-center border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/30">
                                      <p className="text-[8px] sm:text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">LISTA VACÍA</p>
                                   </div>
                                )}
                             </div>
                          </div>
                          
                          <div className="flex items-center justify-between bg-slate-900 p-3 sm:p-4 lg:p-5 rounded-[20px] sm:rounded-[28px] border border-slate-800 shadow-2xl shrink-0 transition-all">
                             <div className="flex flex-col">
                                <span className="text-[8px] sm:text-[9px] lg:text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">TOTAL ESTIMADO</span>
                                <span className="text-[7px] sm:text-[8px] font-bold text-slate-600 mt-1 leading-none">Cálculo automático</span>
                             </div>
                             <span className="text-lg sm:text-2xl lg:text-3xl font-black text-emerald-400 tracking-tighter drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">
                                {cajaCurrency === 'USD' ? '$' : 'S/'}{calculatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                             </span>
                          </div>
                       </div>
                    )}
                 </div>

                 <div className="flex gap-2 sm:gap-3 lg:gap-3 pt-2.5 sm:pt-3 lg:pt-4 border-t border-slate-800/60 shrink-0">
                    <button 
                      onClick={() => {setShowCajaModal(false); setCurrentReceiptItems([]);}} 
                      className="flex-1 h-9 sm:h-11 lg:h-11 bg-slate-800 rounded-xl text-slate-400 font-black text-[8px] sm:text-[10px] lg:text-[11px] uppercase tracking-widest hover:bg-slate-700 transition-all active:scale-95"
                    >
                      CERRAR
                    </button>
                    <button 
                      onClick={handleConfirmCaja} 
                      className={`flex-[2] h-9 sm:h-11 lg:h-11 rounded-xl text-white font-black text-[8px] sm:text-[10px] lg:text-[11px] uppercase tracking-widest shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                        cajaType === 'Abono' 
                        ? 'bg-emerald-600 shadow-emerald-500/20 hover:bg-emerald-500' 
                        : 'bg-rose-600 shadow-rose-500/20 hover:bg-rose-500 border-b-2 border-rose-800'
                      }`}
                    >
                      CONFIRMAR MOVIMIENTO
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 z-[400] flex flex-col items-center justify-center p-2 sm:p-4 bg-slate-950/95 backdrop-blur-xl animate-in fade-in select-none">
          {/* Fondo para cerrar al dar clic fuera */}
          <div className="absolute inset-0" onClick={() => setPreviewImage(null)}></div>

          {/* Barra superior de herramientas clínicas */}
          <div className="relative z-10 mb-3 flex flex-wrap items-center justify-center gap-2 bg-slate-900/95 border border-slate-700/80 px-4 py-2 rounded-2xl shadow-2xl backdrop-blur-md">
            <button
              onClick={(e) => { e.stopPropagation(); setPreviewZoom(prev => Math.min(prev + 0.5, 8)); }}
              className="size-9 bg-slate-800 hover:bg-slate-700 text-white rounded-xl flex items-center justify-center transition-all active:scale-95 shadow cursor-pointer"
              title="Acercar (+50%)"
            >
              <span className="material-symbols-outlined text-lg">zoom_in</span>
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); setPreviewZoom(prev => Math.max(prev - 0.5, 0.5)); }}
              className="size-9 bg-slate-800 hover:bg-slate-700 text-white rounded-xl flex items-center justify-center transition-all active:scale-95 shadow cursor-pointer"
              title="Alejar (-50%)"
            >
              <span className="material-symbols-outlined text-lg">zoom_out</span>
            </button>

            <div className="w-px h-5 bg-slate-700/80 mx-1"></div>

            <button
              onClick={(e) => { e.stopPropagation(); handleDownloadOriginal(previewImage); }}
              className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow cursor-pointer text-[10px] font-black uppercase tracking-wider"
              title="Descargar imagen HD original desde Backblaze"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              <span>DESCARGAR</span>
            </button>

            <div className="w-px h-5 bg-slate-700/80 mx-1"></div>

            <button
              onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}
              className="h-9 px-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black text-[9px] uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95 shadow cursor-pointer"
              title="Cerrar visor (Esc)"
            >
              <span className="material-symbols-outlined text-sm">close</span>
              CERRAR
            </button>
          </div>

          {/* Lienzo del visor interactivo con arrastre (pan) y zoom por rueda */}
          <div 
            className="relative z-10 w-full max-w-[96vw] h-[80vh] flex items-center justify-center overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/90 backdrop-blur-sm cursor-grab active:cursor-grabbing"
            onWheel={(e) => {
              e.preventDefault();
              const delta = e.deltaY < 0 ? 0.35 : -0.35;
              setPreviewZoom(prev => Math.min(Math.max(prev + delta, 0.5), 8));
            }}
            onMouseDown={(e) => {
              if (previewZoom > 1) {
                setIsDraggingPreview(true);
                dragStartRef.current = { x: e.clientX - previewPosition.x, y: e.clientY - previewPosition.y };
              }
            }}
            onMouseMove={(e) => {
              if (isDraggingPreview) {
                setPreviewPosition({
                  x: e.clientX - dragStartRef.current.x,
                  y: e.clientY - dragStartRef.current.y
                });
              }
            }}
            onMouseUp={() => setIsDraggingPreview(false)}
            onMouseLeave={() => setIsDraggingPreview(false)}
          >
            <div
              style={{
                transform: `translate(${previewPosition.x}px, ${previewPosition.y}px) scale(${previewZoom}) rotate(${previewRotation}deg)`,
                transition: isDraggingPreview ? 'none' : 'transform 0.15s ease-out'
              }}
              className="max-w-full max-h-full flex items-center justify-center pointer-events-none"
            >
              <img
                src={previewImage}
                alt="Vista Clínica HD"
                style={{
                  imageRendering: 'high-quality',
                  filter: isHighContrastText ? 'contrast(1.35) brightness(1.02) saturate(1.1)' : 'none'
                }}
                className="max-w-[88vw] max-h-[75vh] object-contain rounded-2xl shadow-2xl transition-all"
                draggable={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientClinicalRecord;
