import { useEffect, useRef, useSyncExternalStore } from 'react';
import styled, { keyframes } from 'styled-components';
import { FiAlertTriangle, FiInfo, FiTrash2 } from 'react-icons/fi';
import { pedidoActual, suscribir } from '../utils/confirmar';
import { Button } from './ui';
import { theme as t } from '../styles/GlobalStyle';

const TIPOS = {
  peligro: { icono: FiTrash2, color: '#dc2626', fondo: '#fee2e2', boton: 'danger' },
  aviso: { icono: FiAlertTriangle, color: '#d97706', fondo: '#fef3c7', boton: 'primary' },
  info: { icono: FiInfo, color: t.primary, fondo: t.primarySoft, boton: 'primary' },
};

const aparecer = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const subir = keyframes`
  from { opacity: 0; transform: translateY(12px) scale(0.97); }
  to { opacity: 1; transform: none; }
`;

const Fondo = styled.div`
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(15, 23, 42, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: ${aparecer} 0.15s ease-out;
`;

const Caja = styled.div`
  background: #fff;
  border-radius: 16px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.3);
  padding: 24px 24px 20px;
  text-align: center;
  animation: ${subir} 0.18s ease-out;
  h3 { font-size: 18px; margin: 14px 0 6px; }
  p { margin: 0; color: ${t.muted}; line-height: 1.5; white-space: pre-line; }
`;

const Icono = styled.div`
  width: 52px;
  height: 52px;
  border-radius: 50%;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${(p) => p.$color};
  background: ${(p) => p.$fondo};
`;

const Botones = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 22px;
  button { flex: 1; justify-content: center; padding-top: 10px; padding-bottom: 10px; }
`;

export default function ConfirmHost() {
  const pedido = useSyncExternalStore(suscribir, pedidoActual);
  const aceptarRef = useRef(null);

  useEffect(() => {
    if (!pedido) return;
    aceptarRef.current?.focus();
    // Escape cierra solo este cuadro, no el modal que pueda haber debajo.
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      pedido.resolver(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [pedido]);

  if (!pedido) return null;
  const tipo = TIPOS[pedido.tipo] || TIPOS.info;
  const Ico = tipo.icono;

  return (
    <Fondo onMouseDown={(e) => e.target === e.currentTarget && pedido.resolver(false)}>
      <Caja role="alertdialog" aria-modal="true" aria-labelledby="confirm-titulo">
        <Icono $color={tipo.color} $fondo={tipo.fondo}>
          <Ico size={24} />
        </Icono>
        <h3 id="confirm-titulo">{pedido.titulo}</h3>
        {pedido.mensaje && <p>{pedido.mensaje}</p>}
        <Botones>
          <Button $variant="secondary" onClick={() => pedido.resolver(false)}>
            {pedido.cancelar}
          </Button>
          <Button ref={aceptarRef} $variant={tipo.boton} onClick={() => pedido.resolver(true)}>
            {pedido.aceptar}
          </Button>
        </Botones>
      </Caja>
    </Fondo>
  );
}
