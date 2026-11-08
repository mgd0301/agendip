import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import toast from 'react-hot-toast';
import { FaWhatsapp } from 'react-icons/fa';
import { FiChevronLeft, FiChevronRight, FiPlus, FiRefreshCw } from 'react-icons/fi';
import api, { errorMsg } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useDatos } from '../../context/DatosContext';
import { Button, IconButton, Row, Segmented } from '../../components/ui';
import { DIAS_CORTOS, MESES, diaSemana, fechaLarga, finMes, hoy, inicioMes, inicioSemana, rango, sumarDias, sumarMeses } from '../../utils/fechas';
import { theme as t } from '../../styles/GlobalStyle';
import GrillaAgenda from './GrillaAgenda';
import VistaMes from './VistaMes';
import TurnoModal from './TurnoModal';
import EnviarAgendaModal from '../../components/EnviarAgendaModal';

const Wrap = styled.div`
  padding: 16px 20px;
  @media ${t.mobile} { padding: 10px 8px 76px; }
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
  h2 { font-size: 18px; text-transform: capitalize; min-width: 0; }
`;

const girar = keyframes`
  to { transform: rotate(360deg); }
`;

const BotonRecargar = styled(IconButton)`
  svg { transition: color 0.2s; }
  ${(p) =>
    p.$girando &&
    css`
      color: ${t.primary};
      svg { animation: ${girar} 0.7s linear infinite; }
    `}
`;

const Chips = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 12px;
  @media ${t.mobile} { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 4px; }
`;

const Chip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$on ? p.$color : t.border)};
  background: ${(p) => (p.$on ? `${p.$color}14` : '#fff')};
  color: ${(p) => (p.$on ? t.text : t.muted)};
  cursor: pointer;
  white-space: nowrap;
  font-size: 13px;
  i { width: 9px; height: 9px; border-radius: 50%; background: ${(p) => (p.$on ? p.$color : '#cbd5e1')}; }
`;

const Leyenda = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 10px;
  font-size: 12px;
  color: ${t.muted};
  span { display: inline-flex; align-items: center; gap: 5px; }
  i { width: 9px; height: 9px; border-radius: 50%; }
`;

const esMovil = () => window.matchMedia(t.mobile).matches;
const leer = (k, def) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? def;
  } catch {
    return def;
  }
};

export default function Agenda() {
  const { usuario } = useAuth();
  const { profesionales, estados } = useDatos();
  const [vista, setVista] = useState(() => (esMovil() ? 'dia' : leer('agendia_vista', 'semana')));
  const [fecha, setFecha] = useState(hoy());
  const [seleccion, setSeleccion] = useState(() => leer('agendia_profs', null));
  const [datos, setDatos] = useState({ turnos: [], disponibilidad: {} });
  const [modal, setModal] = useState(null);
  const [enviando, setEnviando] = useState(false);

  // Profesionales visibles: el rol profesional solo ve su agenda.
  const visibles = useMemo(
    () => (usuario.rol === 'profesional' ? profesionales.filter((p) => p.id === usuario.profesional_id) : profesionales),
    [profesionales, usuario]
  );
  const profIds = useMemo(() => {
    const ids = visibles.map((p) => p.id);
    const sel = (seleccion || ids).filter((id) => ids.includes(id));
    return sel.length ? sel : ids.slice(0, 1);
  }, [visibles, seleccion]);
  const profSel = visibles.filter((p) => profIds.includes(p.id));

  useEffect(() => {
    try {
      localStorage.setItem('agendia_vista', JSON.stringify(vista));
      if (seleccion) localStorage.setItem('agendia_profs', JSON.stringify(seleccion));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [vista, seleccion]);

  const [desde, hasta] = useMemo(() => {
    if (vista === 'dia') return [fecha, fecha];
    if (vista === 'semana') {
      const a = inicioSemana(fecha);
      return [a, sumarDias(a, 6)];
    }
    const a = inicioSemana(inicioMes(fecha));
    return [a, sumarDias(a, 41)];
  }, [vista, fecha]);

  // Incrementar `version` fuerza una recarga (por ejemplo, después de guardar un turno).
  const [version, setVersion] = useState(0);
  const cargar = useCallback(() => setVersion((v) => v + 1), []);

  // Botón recargar: el ícono gira hasta que llegan los datos (al menos un instante, para que se note).
  const [girando, setGirando] = useState(false);
  const inicioRecarga = useRef(0);
  const recargar = () => {
    inicioRecarga.current = Date.now();
    setGirando(true);
    cargar();
  };

  useEffect(() => {
    if (!profIds.length) return;
    const ctrl = new AbortController();
    api
      .get('/turnos/agenda', { params: { desde, hasta, profesionales: profIds.join(',') }, signal: ctrl.signal })
      .then((r) => setDatos(r.data))
      .catch((err) => {
        if (!ctrl.signal.aborted) toast.error(errorMsg(err));
      })
      .finally(() => {
        if (ctrl.signal.aborted) return;
        const resto = 700 - (Date.now() - inicioRecarga.current);
        setTimeout(() => setGirando(false), Math.max(0, resto));
      });
    return () => ctrl.abort();
  }, [desde, hasta, profIds, version]);

  const mover = (n) => {
    if (vista === 'dia') setFecha(sumarDias(fecha, n));
    else if (vista === 'semana') setFecha(sumarDias(fecha, 7 * n));
    else setFecha(sumarMeses(fecha, n));
  };

  const toggleProf = (id) => {
    const actual = profIds;
    const nuevo = actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id];
    if (nuevo.length) setSeleccion(nuevo);
  };

  const titulo = useMemo(() => {
    if (vista === 'dia') return fechaLarga(fecha);
    if (vista === 'mes') return `${MESES[Number(fecha.slice(5, 7)) - 1]} ${fecha.slice(0, 4)}`;
    const a = desde;
    const b = hasta;
    const mA = MESES[Number(a.slice(5, 7)) - 1];
    const mB = MESES[Number(b.slice(5, 7)) - 1];
    return mA === mB ? `${Number(a.slice(8))} al ${Number(b.slice(8))} de ${mA}` : `${Number(a.slice(8))} ${mA.slice(0, 3)} al ${Number(b.slice(8))} ${mB.slice(0, 3)}`;
  }, [vista, fecha, desde, hasta]);

  // Columnas: en vista día, una por profesional; en semana, una por día.
  const columnas = useMemo(() => {
    if (vista === 'dia') {
      return profSel.map((p) => ({
        key: `${p.id}`,
        fecha,
        titulo: `${p.apellido}, ${p.nombre}`,
        subtitulo: p.especialidad,
        color: p.color,
        profIds: [p.id],
      }));
    }
    if (vista === 'semana') {
      return rango(desde, hasta).map((f) => {
        const cant = datos.turnos.filter((tu) => tu.inicio.startsWith(f)).length;
        return {
          key: f,
          fecha: f,
          titulo: `${DIAS_CORTOS[diaSemana(f)]} ${Number(f.slice(8))}`,
          subtitulo: cant ? `${cant} turno${cant > 1 ? 's' : ''}` : '',
          profIds,
        };
      });
    }
    return [];
  }, [vista, fecha, desde, hasta, profSel, profIds, datos.turnos]);

  const alGuardar = (_, opciones = {}) => {
    cargar();
    if (opciones.cerrar !== false) setModal(null);
  };

  if (!visibles.length) {
    return (
      <Wrap>
        <p>
          {usuario.rol === 'profesional'
            ? 'Su usuario no está vinculado a un profesional. Consulte con el administrador.'
            : 'Todavía no hay profesionales cargados. Comience dando de alta uno en la sección Profesionales.'}
        </p>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <Toolbar>
        <Row>
          <Button $variant="secondary" onClick={() => setFecha(hoy())}>
            Hoy
          </Button>
          <IconButton onClick={() => mover(-1)} aria-label="Anterior">
            <FiChevronLeft size={20} />
          </IconButton>
          <IconButton onClick={() => mover(1)} aria-label="Siguiente">
            <FiChevronRight size={20} />
          </IconButton>
          <BotonRecargar onClick={recargar} disabled={girando} $girando={girando} aria-label="Recargar agenda" title="Recargar agenda">
            <FiRefreshCw size={18} />
          </BotonRecargar>
        </Row>
        <h2>{titulo}</h2>
        <Row style={{ marginLeft: 'auto' }}>
          <Segmented>
            {[
              ['dia', 'Día'],
              ['semana', 'Semana'],
              ['mes', 'Mes'],
            ].map(([v, l]) => (
              <button key={v} aria-pressed={vista === v} onClick={() => setVista(v)}>
                {l}
              </button>
            ))}
          </Segmented>
          <Button $variant="secondary" onClick={() => setEnviando(true)} title="Enviar la agenda al profesional por WhatsApp">
            <FaWhatsapp /> Enviar
          </Button>
          <Button onClick={() => setModal({ inicial: { fecha, profesional_id: profIds.length === 1 ? profIds[0] : undefined } })}>
            <FiPlus /> Turno
          </Button>
        </Row>
      </Toolbar>

      {visibles.length > 1 && (
        <Chips>
          {visibles.map((p) => (
            <Chip key={p.id} $on={profIds.includes(p.id)} $color={p.color} onClick={() => toggleProf(p.id)}>
              <i /> {p.apellido}, {p.nombre}
            </Chip>
          ))}
          {profIds.length < visibles.length && (
            <Chip $color={t.primary} onClick={() => setSeleccion(visibles.map((p) => p.id))}>
              Ver todos
            </Chip>
          )}
        </Chips>
      )}

      {vista === 'mes' ? (
        <VistaMes
          fecha={fecha}
          desde={desde}
          datos={datos}
          profIds={profIds}
          estados={estados}
          onDia={(f) => {
            setFecha(f);
            setVista('dia');
          }}
        />
      ) : (
        <GrillaAgenda
          columnas={columnas}
          datos={datos}
          estados={estados}
          profesionales={profesionales}
          minWidth={vista === 'dia' ? 200 : 120}
          onNuevo={(inicial) => setModal({ inicial })}
          onAbrir={(id) => setModal({ turnoId: id })}
        />
      )}

      <Leyenda>
        {Object.entries(estados)
          .filter(([k]) => k !== 'cancelado')
          .map(([k, e]) => (
            <span key={k}>
              <i style={{ background: e.color }} /> {e.etiqueta}
            </span>
          ))}
        <span>
          <i style={{ background: 'repeating-linear-gradient(135deg, #cbd5e1 0 3px, #e2e8f0 3px 6px)', borderRadius: 2, width: 14, height: 12 }} /> Fuera de
          horario
        </span>
        <span>
          <i style={{ background: 'repeating-linear-gradient(135deg, #fca5a5 0 3px, #fecaca 3px 6px)', border: '1px solid #dc2626', borderRadius: 2, width: 14, height: 12 }} />{' '}
          Feriado / bloqueo
        </span>
        {vista !== 'mes' && <span>Hacé clic en un horario libre para asignar un turno.</span>}
      </Leyenda>

      {modal && (
        <TurnoModal key={modal.turnoId || 'nuevo'} turnoId={modal.turnoId} inicial={modal.inicial} onClose={() => setModal(null)} onSaved={alGuardar} />
      )}
      {enviando && (
        <EnviarAgendaModal
          profesionalId={profIds[0]}
          desde={vista === 'mes' ? inicioMes(fecha) : desde}
          hasta={vista === 'mes' ? finMes(fecha) : hasta}
          onClose={() => setEnviando(false)}
        />
      )}
    </Wrap>
  );
}
