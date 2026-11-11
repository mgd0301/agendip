import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api';

// Catálogos compartidos por toda la app: profesionales, prestaciones, obras sociales y colores de estados.
const DatosContext = createContext(null);

export const ESTADOS = ['pendiente', 'confirmado', 'atendido', 'ausente', 'cancelado'];

const ESTADOS_DEFAULT = {
  pendiente: { etiqueta: 'Pendiente', color: '#f59e0b' },
  confirmado: { etiqueta: 'Confirmado', color: '#2563eb' },
  atendido: { etiqueta: 'Atendido', color: '#16a34a' },
  ausente: { etiqueta: 'Ausente', color: '#dc2626' },
  cancelado: { etiqueta: 'Cancelado', color: '#94a3b8' },
};

export function DatosProvider({ children }) {
  const [profesionales, setProfesionales] = useState([]);
  const [prestaciones, setPrestaciones] = useState([]);
  const [obrasSociales, setObrasSociales] = useState([]);
  const [estados, setEstados] = useState(ESTADOS_DEFAULT);

  // Incrementar `version` vuelve a pedir los catálogos al servidor.
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    Promise.all([api.get('/profesionales'), api.get('/prestaciones'), api.get('/config/estados'), api.get('/obras-sociales')])
      .then(([p, s, e, os]) => {
        setProfesionales(p.data);
        setPrestaciones(s.data);
        setObrasSociales(os.data);
        const map = { ...ESTADOS_DEFAULT };
        for (const x of e.data) map[x.estado] = { etiqueta: x.etiqueta, color: x.color };
        setEstados(map);
      })
      .catch(() => {});
  }, [version]);

  const value = useMemo(
    () => ({ profesionales, prestaciones, obrasSociales, estados, recargar }),
    [profesionales, prestaciones, obrasSociales, estados, recargar]
  );
  return <DatosContext.Provider value={value}>{children}</DatosContext.Provider>;
}

 
export const useDatos = () => useContext(DatosContext);
