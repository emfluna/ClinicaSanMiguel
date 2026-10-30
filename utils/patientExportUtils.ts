
import { Patient } from '../types';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { supabase } from '../services/supabaseClient';

export const downloadPatientZip = async (patient: Patient): Promise<boolean> => {
  try {
    const zip = new JSZip();
    
    // Naming convention: DNI_NOMBRECOMPLETO
    const patientDNI = (patient.dni || '00000000').replace(/[^a-z0-9]/gi, '');
    const patientFullNameSanitized = (patient.name || 'paciente').replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, '_').toUpperCase();
    const baseFilename = `${patientDNI}_${patientFullNameSanitized}`;

    // 1. Preparar Información Clínica para Excel (XLSX)
    const medicalConditions = Object.entries(patient.medicalFlags || {})
      .filter(([key, value]) => value === true && key !== 'others')
      .map(([key]) => {
        switch(key) {
          case 'heartProblems': return 'Problemas Cardíacos';
          case 'coagulation': return 'Coagulación';
          case 'asthma': return 'Asma';
          case 'hypertension': return 'Hipertensión';
          case 'diabetes': return 'Diabetes';
          case 'epilepsy': return 'Epilepsia';
          case 'pregnancy': return 'Embarazo';
          case 'allergies': return 'Alergias';
          case 'anemia': return 'Anemia';
          default: return key;
        }
      });
    
    if (patient.medicalFlags?.others) {
      medicalConditions.push(`Otros: ${patient.medicalFlags.others}`);
    }
    const antecedentesStr = medicalConditions.length > 0 ? medicalConditions.join(', ') : 'Ninguno';

    // Historial Clínico detallado
    const historyNotes = (patient.clinicalNotes || [])
      .map(n => `[${n.date} ${n.time}] ${n.author}: ${n.text}`)
      .join('\n');

    // Objeto de una sola fila
    const patientDataRow = {
      "Nombre": patient.nombres || patient.name.split(' ')[0] || '',
      "Apellido": patient.apellidos || patient.name.split(' ').slice(1).join(' ') || '',
      "DNI": patient.dni || '',
      "Fecha de Nacimiento": patient.fecha_nacimiento || '',
      "Género": patient.gender === 'Male' ? 'Masculino' : patient.gender === 'Female' ? 'Femenino' : 'Otro',
      "Teléfono": patient.phone || '',
      "Email": patient.email || '',
      "Dirección": patient.address || '',
      "Antecedentes Médicos": antecedentesStr,
      "Historial Clínico": historyNotes || 'Sin notas registradas'
    };

    const worksheet = XLSX.utils.json_to_sheet([patientDataRow]);
    
    const wscols = [
      {wch: 15}, {wch: 20}, {wch: 12}, {wch: 15}, {wch: 10}, 
      {wch: 15}, {wch: 25}, {wch: 30}, {wch: 40}, {wch: 80}
    ];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ficha Paciente");

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    zip.file(`${baseFilename}.xlsx`, excelBuffer);

    // Fetch full patient images on demand for ZIP download
    let patientImages = patient.images || [];
    if (!patientImages || patientImages.length === 0 || patientImages.some(img => !img.url)) {
      try {
        const { data } = await supabase
          .from('galeria_clinica')
          .select('id, fecha, url_foto, descripcion')
          .eq('paciente_id', patient.id)
          .order('fecha', { ascending: false });
        if (data && data.length > 0) {
          patientImages = data.map((g: any) => ({
            id: g.id,
            date: new Date(g.fecha).toISOString(),
            url: g.url_foto,
            label: g.descripcion || 'Imagen Clínica'
          }));
        }
      } catch (e) {
        console.error("Error fetching images for ZIP:", e);
      }
    }

    // 2. Procesar Imágenes
    if (patientImages && patientImages.length > 0) {
      const imgFolder = zip.folder("imagenes_clinicas");
      
      await Promise.all(patientImages.map(async (img, index) => {
        try {
          let data: string | ArrayBuffer = '';
          let extension = 'png';

          if (img.url && img.url.startsWith('data:image')) {
            data = img.url.split(',')[1];
            extension = img.url.substring(img.url.indexOf('/') + 1, img.url.indexOf(';'));
            imgFolder?.file(`imagen_${index + 1}_${img.date.replace(/\//g, '-')}.${extension}`, data, { base64: true });
          } else if (img.url) {
            const response = await fetch(img.url);
            const blob = await response.blob();
            imgFolder?.file(`imagen_${index + 1}_${img.date.replace(/\//g, '-')}.jpg`, blob);
          }
        } catch (e) {
          console.error("Error al procesar imagen para ZIP:", e);
          imgFolder?.file(`error_imagen_${index + 1}.txt`, "No se pudo descargar esta imagen.");
        }
      }));
    }

    // 3. Generar y Descargar ZIP
    const content = await zip.generateAsync({ type: "blob" });
    const filename = `${baseFilename}.zip`;

    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Update LocalStorage
    const currentPatientZipDownloadStatus: Record<string, string> = JSON.parse(
      localStorage.getItem('lastPatientZipDownloadStatus') || '{}'
    );
    currentPatientZipDownloadStatus[patient.id] = patient.updated_at || new Date().toISOString(); 
    localStorage.setItem('lastPatientZipDownloadStatus', JSON.stringify(currentPatientZipDownloadStatus));
    
    return true;
  } catch (err) {
    console.error("Error generating patient zip:", err);
    return false;
  }
};
