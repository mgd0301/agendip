import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(() => !!localStorage.getItem('agendia_token'));

  useEffect(() => {
    if (!localStorage.getItem('agendia_token')) return;
    api
      .get('/auth/me')
      .then((r) => setUsuario(r.data))
      .catch(() => localStorage.removeItem('agendia_token'))
      .finally(() => setCargando(false));
  }, []);

  const iniciar = useCallback(({ token, usuario }) => {
    localStorage.setItem('agendia_token', token);
    setUsuario(usuario);
  }, []);

  const salir = useCallback(() => {
    localStorage.removeItem('agendia_token');
    setUsuario(null);
  }, []);

  return <AuthContext.Provider value={{ usuario, cargando, iniciar, salir }}>{children}</AuthContext.Provider>;
}

 
export const useAuth = () => useContext(AuthContext);
