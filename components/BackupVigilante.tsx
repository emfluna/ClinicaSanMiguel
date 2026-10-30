// BackupVigilante: Las descargas automáticas han sido desactivadas a petición del usuario.
// Ahora los respaldos y exportaciones son 100% bajo demanda y manuales desde la Lista de Pacientes o Barra Lateral.

import React from 'react';
import { AppNotification } from '../types';

interface BackupVigilanteProps {
  onAddNotification: (type: AppNotification['type'], title: string, message: string, isAbono: boolean) => void;
}

const BackupVigilante: React.FC<BackupVigilanteProps> = () => {
  // Sin descargas automáticas en segundo plano. Los respaldos se realizan únicamente bajo demanda del doctor/usuario.
  return null;
};

export default BackupVigilante;