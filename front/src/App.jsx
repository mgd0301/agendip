import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GlobalStyle } from './styles/GlobalStyle';
import { Spinner } from './components/ui';
import Layout from './components/Layout';
import ConfirmHost from './components/ConfirmHost';
import Login from './pages/Login';
import Agenda from './pages/agenda/Agenda';
import Turnos from './pages/Turnos';
import Pacientes from './pages/Pacientes';
import Profesionales from './pages/Profesionales';
import Prestaciones from './pages/Prestaciones';
import Excepciones from './pages/Excepciones';
import Reportes from './pages/Reportes';
import Usuarios from './pages/Usuarios';
import Configuracion from './pages/Configuracion';

function Rutas() {
  const { usuario, cargando } = useAuth();
  if (cargando) return <Spinner />;
  if (!usuario) return <Login />;
  const admin = usuario.rol === 'admin';

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Agenda />} />
        <Route path="turnos" element={<Turnos />} />
        <Route path="pacientes" element={<Pacientes />} />
        <Route path="profesionales" element={<Profesionales />} />
        <Route path="prestaciones" element={<Prestaciones />} />
        <Route path="excepciones" element={<Excepciones />} />
        <Route path="reportes" element={<Reportes />} />
        {admin && <Route path="usuarios" element={<Usuarios />} />}
        {admin && <Route path="configuracion" element={<Configuracion />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <GlobalStyle />
      <Toaster
        position="top-center"
        gutter={10}
        containerStyle={{ top: 16 }}
        toastOptions={{
          duration: 3500,
          style: {
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: 500,
            color: '#0f172a',
            background: '#fff',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.18)',
            maxWidth: '440px',
          },
          success: { iconTheme: { primary: '#16a34a', secondary: '#fff' }, style: { borderLeft: '4px solid #16a34a' } },
          error: { duration: 5500, iconTheme: { primary: '#dc2626', secondary: '#fff' }, style: { borderLeft: '4px solid #dc2626' } },
        }}
      />
      <ConfirmHost />
      <AuthProvider>
        <Rutas />
      </AuthProvider>
    </BrowserRouter>
  );
}
