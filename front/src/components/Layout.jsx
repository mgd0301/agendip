import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import styled from 'styled-components';
import {
  FiCalendar, FiList, FiUsers, FiCreditCard, FiUserCheck, FiTag, FiSlash, FiBarChart2, FiShield, FiSettings, FiLogOut, FiMenu, FiX,
} from 'react-icons/fi';
import { theme as t } from '../styles/GlobalStyle';
import { useAuth } from '../context/AuthContext';
import { DatosProvider } from '../context/DatosContext';

const ROL = { admin: 'Administrador', recepcion: 'Recepción', profesional: 'Profesional' };

const MENU = [
  { to: '/', label: 'Agenda', icon: FiCalendar, end: true },
  { to: '/turnos', label: 'Turnos', icon: FiList },
  { to: '/pacientes', label: 'Pacientes', icon: FiUsers },
  { to: '/profesionales', label: 'Profesionales', icon: FiUserCheck },
  { to: '/prestaciones', label: 'Prestaciones', icon: FiTag },
  { to: '/obras-sociales', label: 'Obras sociales', icon: FiCreditCard },
  { to: '/excepciones', label: 'Feriados y bloqueos', icon: FiSlash },
  { to: '/reportes', label: 'Reportes', icon: FiBarChart2 },
  { to: '/usuarios', label: 'Usuarios', icon: FiShield, roles: ['admin'] },
  { to: '/configuracion', label: 'Configuración', icon: FiSettings, roles: ['admin'] },
];

// En la barra inferior del celular se muestran los accesos más usados.
const MOVIL = ['/', '/turnos', '/pacientes'];

const Shell = styled.div`
  display: flex;
  min-height: 100%;
`;

const Sidebar = styled.aside`
  width: 232px;
  flex-shrink: 0;
  background: #0f1d3a;
  color: #cbd5e1;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
  @media ${t.mobile} {
    position: fixed;
    z-index: 90;
    left: 0;
    transform: translateX(${(p) => (p.$open ? '0' : '-100%')});
    transition: transform 0.2s;
    box-shadow: ${(p) => (p.$open ? '0 0 40px rgba(0,0,0,0.3)' : 'none')};
  }
`;

const Brand = styled.div`
  padding: 20px 18px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  strong { font-size: 20px; color: #fff; letter-spacing: -0.02em; }
  span { color: #60a5fa; }
  small { display: block; color: #94a3b8; font-size: 12px; margin-top: 2px; }
  button { display: none; background: none; border: none; color: #fff; cursor: pointer; }
  @media ${t.mobile} { button { display: block; } }
`;

const Nav = styled.nav`
  flex: 1;
  padding: 6px 10px;
  overflow-y: auto;
  a {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 10px;
    border-radius: 8px;
    color: #cbd5e1;
    margin-bottom: 2px;
  }
  a:hover { background: rgba(255, 255, 255, 0.06); color: #fff; }
  a.active { background: ${t.primary}; color: #fff; }
`;

const UserBox = styled.div`
  padding: 14px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 13px;
  div { color: #fff; font-weight: 500; }
  small { color: #94a3b8; }
  button {
    margin-top: 10px;
    display: flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 0;
  }
  button:hover { color: #fff; }
`;

const Main = styled.main`
  flex: 1;
  min-width: 0;
`;

const TopBar = styled.header`
  display: none;
  @media ${t.mobile} {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: #0f1d3a;
    color: #fff;
    position: sticky;
    top: 0;
    z-index: 50;
    button { background: none; border: none; color: #fff; cursor: pointer; display: flex; }
    strong span { color: #60a5fa; }
  }
`;

const BottomNav = styled.nav`
  display: none;
  @media ${t.mobile} {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #fff;
    border-top: 1px solid ${t.border};
    z-index: 60;
    padding-bottom: env(safe-area-inset-bottom);
    a, button {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 8px 0;
      font-size: 11px;
      color: ${t.muted};
      background: none;
      border: none;
    }
    a.active { color: ${t.primary}; }
  }
`;

const Backdrop = styled.div`
  @media ${t.mobile} {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 80;
  }
`;

export default function Layout() {
  const { usuario, salir } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const items = MENU.filter((m) => !m.roles || m.roles.includes(usuario.rol));

  return (
    <DatosProvider>
      <Shell>
        {abierto && <Backdrop onClick={() => setAbierto(false)} />}
        <Sidebar $open={abierto}>
          <Brand>
            <div>
              <strong>
                Agend<span>ip</span>
              </strong>
              <small>{usuario.organizacion.nombre}</small>
            </div>
            <button onClick={() => setAbierto(false)} aria-label="Cerrar menú">
              <FiX size={20} />
            </button>
          </Brand>
          <Nav>
            {items.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} onClick={() => setAbierto(false)}>
                <Icon size={17} /> {label}
              </NavLink>
            ))}
          </Nav>
          <UserBox>
            <div>{usuario.nombre}</div>
            <small>{ROL[usuario.rol]}</small>
            <button onClick={salir}>
              <FiLogOut /> Cerrar sesión
            </button>
          </UserBox>
        </Sidebar>
        <Main>
          <TopBar>
            <button onClick={() => setAbierto(true)} aria-label="Abrir menú">
              <FiMenu size={22} />
            </button>
            <strong>
              Agend<span>ip</span>
            </strong>
          </TopBar>
          <Outlet />
        </Main>
        <BottomNav>
          {items
            .filter((m) => MOVIL.includes(m.to))
            .map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end}>
                <Icon size={20} />
                {label}
              </NavLink>
            ))}
          <button onClick={() => setAbierto(true)}>
            <FiMenu size={20} />
            Más
          </button>
        </BottomNav>
      </Shell>
    </DatosProvider>
  );
}
