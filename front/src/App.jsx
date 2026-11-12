import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
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
import ObrasSociales from './pages/ObrasSociales';
import Superadmin from './pages/Superadmin';
import MiCuenta from './pages/MiCuenta';
import HistoriaClinica from './pages/HistoriaClinica';
import Restablecer from './pages/Restablecer';

function Rutas() {
  const { usuario, cargando } = useAuth();
  const { pathname } = useLocation();
  // El link del email de recuperación funciona con o sin sesión iniciada.
  if (pathname === '/restablecer') return <Restablecer />;
  if (cargando) return <Spinner />;
  if (!usuario) return <Login />;
  const admin = usuario.rol === 'admin';

  // Superadmin en su panel, sin organización elegida: solo ve la lista de organizaciones.
  if (!usuario.organizacion) {
    return (
      <Routes>
        <Route element={<Layout />}>
          <Route path="superadmin" element={<Superadmin />} />
          <Route path="mi-cuenta" element={<MiCuenta />} />
          <Route path="*" element={<Navigate to="/superadmin" replace />} />
        </Route>
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Agenda />} />
        <Route path="turnos" element={<Turnos />} />
        <Route path="pacientes" element={<Pacientes />} />
        {usuario.profesional_id && <Route path="pacientes/:id/historia" element={<HistoriaClinica />} />}
        <Route path="profesionales" element={<Profesionales />} />
        <Route path="prestaciones" element={<Prestaciones />} />
        <Route path="obras-sociales" element={<ObrasSociales />} />
        <Route path="excepciones" element={<Excepciones />} />
        <Route path="reportes" element={<Reportes />} />
        {admin && <Route path="usuarios" element={<Usuarios />} />}
        {admin && <Route path="configuracion" element={<Configuracion />} />}
        {usuario.es_superadmin && <Route path="superadmin" element={<Superadmin />} />}
        <Route path="mi-cuenta" element={<MiCuenta />} />
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
