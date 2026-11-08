import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(() => !!localStorage.getItem('agendip_token'));

  useEffect(() => {
    if (!localStorage.getItem('agendip_token')) return;
    api
      .get('/auth/me')
      .then((r) => setUsuario(r.data))
      .catch(() => localStorage.removeItem('agendip_token'))
      .finally(() => setCargando(false));
  }, []);

  const iniciar = useCallback(({ token, usuario }) => {
    localStorage.setItem('agendip_token', token);
    setUsuario(usuario);
  }, []);

  const salir = useCallback(() => {
    localStorage.removeItem('agendip_token');
    setUsuario(null);
  }, []);

  return <AuthContext.Provider value={{ usuario, cargando, iniciar, salir }}>{children}</AuthContext.Provider>;
}

 
export const useAuth = () => useContext(AuthContext);
