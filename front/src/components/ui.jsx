import { useEffect, useRef } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { FiX } from 'react-icons/fi';
import { theme as t } from '../styles/GlobalStyle';

const variantes = {
  primary: css`
    background: ${t.primary};
    color: #fff;
    border-color: ${t.primary};
    &:hover:not(:disabled) { background: ${t.primaryDark}; }
  `,
  secondary: css`
    background: #fff;
    color: ${t.text};
    border-color: ${t.border};
    &:hover:not(:disabled) { background: #f1f5f9; }
  `,
  danger: css`
    background: #fff;
    color: ${t.danger};
    border-color: #fecaca;
    &:hover:not(:disabled) { background: #fef2f2; }
  `,
  ghost: css`
    background: transparent;
    color: ${t.muted};
    border-color: transparent;
    &:hover:not(:disabled) { background: #f1f5f9; color: ${t.text}; }
  `,
  whatsapp: css`
    background: #16a34a;
    color: #fff;
    border-color: #16a34a;
    &:hover:not(:disabled) { background: #15803d; }
  `,
};

export const Button = styled.button.attrs((p) => ({ type: p.type || 'button', 'data-variant': p.$variant || 'primary' }))`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: ${(p) => (p.$small ? '5px 10px' : '8px 14px')};
  min-height: ${(p) => (p.$small ? '30px' : '38px')};
  border-radius: 8px;
  border: 1px solid;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
  ${(p) => variantes[p.$variant || 'primary']}
  &:disabled { opacity: 0.55; cursor: not-allowed; }
  &:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }
`;

export const IconButton = styled(Button).attrs({ $variant: 'ghost' })`
  padding: 6px;
  min-height: 34px;
  min-width: 34px;
`;

const campo = css`
  width: 100%;
  padding: 8px 10px;
  min-height: 38px;
  border: 1px solid ${t.border};
  border-radius: 8px;
  background: #fff;
  &:focus { outline: none; border-color: ${t.primary}; box-shadow: 0 0 0 3px ${t.primarySoft}; }
  &:disabled { background: #f8fafc; color: ${t.muted}; }
`;

export const Input = styled.input`${campo}`;
export const Select = styled.select`${campo}`;
export const Textarea = styled.textarea`
  ${campo}
  resize: vertical;
  min-height: 70px;
`;

const FieldWrap = styled.label`
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 13px;
  color: ${t.muted};
  font-weight: 500;
  min-width: 0;
`;

export function Field({ label, children, ...rest }) {
  return (
    <FieldWrap {...rest}>
      {label}
      {children}
    </FieldWrap>
  );
}

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(${(p) => p.$cols || 2}, minmax(0, 1fr));
  gap: 12px;
  @media ${t.mobile} { grid-template-columns: 1fr; }
`;

export const Row = styled.div`
  display: flex;
  align-items: center;
  gap: ${(p) => p.$gap || '8px'};
  flex-wrap: ${(p) => (p.$wrap ? 'wrap' : 'nowrap')};
  justify-content: ${(p) => p.$justify || 'flex-start'};
`;

export const Card = styled.div`
  background: ${t.surface};
  border: 1px solid ${t.border};
  border-radius: ${t.radius};
  padding: ${(p) => p.$pad || '16px'};
`;

export const Page = styled.div`
  padding: 20px 24px;
  max-width: ${(p) => p.$max || '1200px'};
  margin: 0 auto;
  @media ${t.mobile} { padding: 14px 12px 80px; }
`;

const HeaderWrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
  h1 { font-size: 22px; }
  p { margin: 2px 0 0; color: ${t.muted}; }
`;

export function PageHeader({ title, subtitle, children }) {
  return (
    <HeaderWrap>
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <Row $wrap>{children}</Row>}
    </HeaderWrap>
  );
}

export const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  color: ${(p) => p.$color || t.muted};
  background: ${(p) => (p.$color ? `${p.$color}1a` : '#f1f5f9')};
  white-space: nowrap;
`;

export const Dot = styled.span`
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${(p) => p.$color};
  flex-shrink: 0;
`;

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid ${t.border}; vertical-align: middle; }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; color: ${t.muted}; font-weight: 600; background: #f8fafc; }
  tbody tr:hover { background: #f8fafc; }
  tr[data-click] { cursor: pointer; }
`;

export const TableWrap = styled(Card).attrs({ $pad: '0' })`
  overflow-x: auto;
`;

export const Empty = styled.div`
  padding: 40px 16px;
  text-align: center;
  color: ${t.muted};
`;

const girar = keyframes`to { transform: rotate(360deg); }`;
export const Spinner = styled.div`
  width: 28px;
  height: 28px;
  border: 3px solid ${t.border};
  border-top-color: ${t.primary};
  border-radius: 50%;
  animation: ${girar} 0.7s linear infinite;
  margin: 40px auto;
`;

export const Check = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  input { width: 16px; height: 16px; accent-color: ${t.primary}; }
`;

export const Tabs = styled.div`
  display: flex;
  gap: 4px;
  border-bottom: 1px solid ${t.border};
  margin-bottom: 14px;
  overflow-x: auto;
`;

export const Tab = styled.button.attrs({ type: 'button' })`
  padding: 8px 12px;
  border: none;
  background: none;
  cursor: pointer;
  border-bottom: 2px solid ${(p) => (p.$active ? t.primary : 'transparent')};
  color: ${(p) => (p.$active ? t.primary : t.muted)};
  font-weight: 500;
  white-space: nowrap;
`;

export const Segmented = styled.div`
  display: inline-flex;
  border: 1px solid ${t.border};
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  button {
    border: none;
    background: none;
    padding: 7px 12px;
    cursor: pointer;
    color: ${t.muted};
    font-weight: 500;
  }
  button + button { border-left: 1px solid ${t.border}; }
  button[aria-pressed='true'] { background: ${t.primarySoft}; color: ${t.primary}; }
`;

// ---------- Modal ----------
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 16px;
  overflow-y: auto;
  z-index: 100;
  @media ${t.mobile} { padding: 0; align-items: stretch; }
`;

const Dialog = styled.div`
  background: #fff;
  border-radius: 14px;
  width: 100%;
  max-width: ${(p) => p.$width || '560px'};
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
  display: flex;
  flex-direction: column;
  @media ${t.mobile} { border-radius: 0; max-width: none; min-height: 100%; }
`;

const DialogHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid ${t.border};
  h3 { font-size: 17px; }
`;

const DialogBody = styled.div`
  padding: 18px;
  flex: 1;
`;

const DialogFoot = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
  padding: 12px 18px;
  border-top: 1px solid ${t.border};
  background: #f8fafc;
  border-radius: 0 0 14px 14px;
  @media ${t.mobile} { position: sticky; bottom: 0; border-radius: 0; }
`;

// Campos que pueden recibir el foco al abrir una ventana. Un campo con data-autofocus tiene prioridad.
const ENFOCABLES = [
  'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=color]):not([disabled]):not([readonly])',
  'select:not([disabled])',
  'textarea:not([disabled])',
].join(',');

// Pone el foco en el primer campo del contenedor. Si el contenido todavía está cargando
// (spinner), espera a que aparezca el formulario. No actúa si el usuario ya está en un campo.
// En pantallas táctiles no se enfoca para que el teclado no tape la ventana.
export function useFocoInicial(ref) {
  useEffect(() => {
    const cont = ref.current;
    if (!cont || window.matchMedia('(pointer: coarse)').matches) return;
    const intentar = () => {
      if (cont.contains(document.activeElement) && document.activeElement.matches(ENFOCABLES)) return true;
      const el = cont.querySelector('[data-autofocus]') || cont.querySelector(ENFOCABLES);
      if (!el) return false;
      el.focus();
      return true;
    };
    if (intentar()) return;
    const obs = new MutationObserver(() => intentar() && obs.disconnect());
    obs.observe(cont, { childList: true, subtree: true });
    const limite = setTimeout(() => obs.disconnect(), 5000);
    return () => {
      obs.disconnect();
      clearTimeout(limite);
    };
  }, [ref]);
}

export function Modal({ title, onClose, children, footer, width }) {
  const cuerpo = useRef(null);
  useFocoInicial(cuerpo);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <Overlay onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <Dialog $width={width} role="dialog" aria-modal="true">
        <DialogHead>
          <h3>{title}</h3>
          <IconButton onClick={onClose} aria-label="Cerrar">
            <FiX size={18} />
          </IconButton>
        </DialogHead>
        <DialogBody ref={cuerpo}>{children}</DialogBody>
        {footer && <DialogFoot>{footer}</DialogFoot>}
      </Dialog>
    </Overlay>
  );
}

export const Muted = styled.span`
  color: ${t.muted};
  font-size: ${(p) => p.$size || 'inherit'};
`;

export const SearchBox = styled.div`
  position: relative;
  flex: 1;
  min-width: 200px;
  max-width: 380px;
  svg { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: ${t.muted}; }
  input { padding-left: 32px; }
`;

export function Pagination({ page, total, limit, onChange }) {
  const paginas = Math.max(1, Math.ceil(total / limit));
  if (paginas <= 1) return null;
  return (
    <Row $justify="space-between" style={{ padding: '10px 12px' }}>
      <Muted>
        {total} resultados · página {page} de {paginas}
      </Muted>
      <Row>
        <Button $small $variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Anterior
        </Button>
        <Button $small $variant="secondary" disabled={page >= paginas} onClick={() => onChange(page + 1)}>
          Siguiente
        </Button>
      </Row>
    </Row>
  );
}
