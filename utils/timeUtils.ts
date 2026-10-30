export const parseTimeToMinutes = (timeStr?: string): number => {
  if (!timeStr) return 0;
  const raw = timeStr.trim().toUpperCase();
  
  const isPM = raw.includes('PM') || raw.includes('P.M.') || raw.includes('TARDE') || raw.includes('NOCHE');
  const isAM = raw.includes('AM') || raw.includes('A.M.') || raw.includes('MAÑANA');
  
  const clean = raw.replace(/[^\d:.]/g, '').replace('.', ':').trim();
  const parts = clean.split(':');
  
  if (parts.length === 0 || !parts[0]) return 0;
  
  let hours = parseInt(parts[0], 10);
  const minutes = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0;
  
  if (isNaN(hours)) return 0;
  
  if (isPM && hours < 12) {
    hours += 12;
  } else if (isAM && hours === 12) {
    hours = 0;
  }
  
  return hours * 60 + minutes;
};
