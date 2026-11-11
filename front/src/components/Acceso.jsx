import styled from 'styled-components';
import { theme as t } from '../styles/GlobalStyle';

// Pantallas de acceso (ingreso, registro, restablecer contraseña).
export const Fondo = styled.div`
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  background: linear-gradient(160deg, #0f1d3a 0%, #1d4ed8 100%);
`;

export const Caja = styled.form`
  width: 100%;
  max-width: 400px;
  background: #fff;
  border-radius: 16px;
  padding: 32px 28px;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  gap: 14px;
  h1 { font-size: 30px; text-align: center; letter-spacing: -0.03em; }
  h1 span { color: ${t.primary}; }
  p { text-align: center; color: ${t.muted}; margin: -8px 0 6px; }
`;

export const Link = styled.button.attrs({ type: 'button' })`
  background: none;
  border: none;
  color: ${t.primary};
  cursor: pointer;
  font-weight: 500;
`;
