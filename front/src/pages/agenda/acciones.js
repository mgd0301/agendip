import { FiCheck, FiUserX } from 'react-icons/fi';

// Cambios de estado rápidos de un turno (ventana del turno y menú ⋮ de la agenda).
export const ACCIONES = [
  { estado: 'confirmado', label: 'Confirmar', icon: FiCheck },
  { estado: 'atendido', label: 'Atendido', icon: FiCheck },
  { estado: 'ausente', label: 'Ausente', icon: FiUserX },
];

// Después de estos cambios la ventana del turno se cierra; al volver a pendiente o reactivar, sigue abierta.
export const CIERRAN = ['confirmado', 'atendido', 'ausente', 'cancelado'];
