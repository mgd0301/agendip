import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styled from "styled-components";
import { FiClock, FiExternalLink, FiVideo, FiXCircle } from "react-icons/fi";
import { theme as t } from "../../styles/GlobalStyle";
import { ACCIONES } from "./acciones";

const Panel = styled.div`
  position: fixed;
  z-index: 60;
  min-width: 190px;
  background: #fff;
  border: 1px solid ${t.border};
  border-radius: 10px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
  padding: 4px;
  header {
    padding: 6px 10px 4px;
    font-size: 12px;
    color: ${t.muted};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 240px;
  }
  hr {
    border: none;
    border-top: 1px solid ${t.border};
    margin: 4px 0;
  }
  button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-radius: 6px;
    background: none;
    color: ${t.text};
    font-size: 14px;
    text-align: left;
    cursor: pointer;
  }
  button:hover {
    background: ${t.primarySoft};
  }
  button.peligro {
    color: ${t.danger};
  }
  button.peligro:hover {
    background: #fef2f2;
  }

  /* En el celular: hoja desde abajo, con botones grandes para el dedo. */
  @media ${t.mobile} {
    left: 8px !important;
    right: 8px;
    top: auto !important;
    bottom: calc(8px + env(safe-area-inset-bottom));
    max-width: none;
    border-radius: 14px;
    padding: 6px;
    header {
      max-width: none;
      font-size: 13px;
      padding: 8px 12px;
    }
    button {
      padding: 14px 12px;
      font-size: 16px;
    }
  }
`;

// Atrapa el toque de afuera que cierra el menú, así no abre un turno en la grilla.
const Fondo = styled.div`
  position: fixed;
  inset: 0;
  z-index: 59;
  @media ${t.mobile} {
    background: rgba(15, 23, 42, 0.35);
  }
`;

/** Menú ⋮ de un turno en la agenda. pos: { x, y } del botón que lo abrió. */
export default function MenuTurno({
  turno,
  pos,
  estados,
  onEstado,
  onCancelar,
  onAbrir,
  onClose,
}) {
  const ref = useRef(null);
  const [lugar, setLugar] = useState({ left: pos.x, top: pos.y });

  // Que no se salga de la pantalla.
  useLayoutEffect(() => {
    const r = ref.current.getBoundingClientRect();
    setLugar({
      left: Math.max(8, Math.min(pos.x, window.innerWidth - r.width - 8)),
      top:
        pos.y + r.height > window.innerHeight - 8
          ? Math.max(8, pos.y - r.height)
          : pos.y,
    });
  }, [pos]);

  useEffect(() => {
    const tecla = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", tecla);
    window.addEventListener("resize", onClose);
    document.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("keydown", tecla);
      window.removeEventListener("resize", onClose);
      document.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  const cancelado = turno.estado === "cancelado";
  const elegir = (fn) => () => {
    onClose();
    fn();
  };

  return (
    <>
      <Fondo
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <Panel ref={ref} style={lugar} role="menu">
        <header>
          {turno.inicio.slice(11, 16)} · {turno.pac_apellido},{" "}
          {turno.pac_nombre}
          {!!Number(turno.es_virtual) && <FiVideo title="Turno virtual" style={{ color: '#0891b2', verticalAlign: '-2px', marginLeft: 6 }} />}
        </header>
        {!cancelado &&
          ACCIONES.filter((a) => a.estado !== turno.estado).map(
            ({ estado, label, icon: Icon }) => (
              <button
                key={estado}
                role="menuitem"
                onClick={elegir(() => onEstado(turno, estado))}
              >
                <Icon color={estados[estado]?.color} /> {label}
              </button>
            ),
          )}
        {!cancelado && turno.estado !== "pendiente" && (
          <button
            role="menuitem"
            onClick={elegir(() => onEstado(turno, "pendiente"))}
          >
            <FiClock /> Volver a pendiente
          </button>
        )}
        {!cancelado && <hr />}
        <button role="menuitem" onClick={elegir(() => onAbrir(turno.id))}>
          <FiExternalLink /> {cancelado ? "Ver turno" : "Abrir turno"}
        </button>
        {!cancelado && (
          <button
            role="menuitem"
            className="peligro"
            onClick={elegir(() => onCancelar(turno))}
          >
            <FiXCircle /> Cancelar turno
          </button>
        )}
      </Panel>
    </>
  );
}
