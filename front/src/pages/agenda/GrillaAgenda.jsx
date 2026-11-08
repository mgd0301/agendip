import { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { aHora, aMin, hoy } from '../../utils/fechas';
import { theme as t } from '../../styles/GlobalStyle';

const PPM = 1.5; // píxeles por minuto: un turno de 30 min mide 45px
const GUTTER = 56;

const Scroller = styled.div`
  overflow: auto;
  max-height: calc(100vh - 170px);
  background: #fff;
  border: 1px solid ${t.border};
  border-radius: ${t.radius};
  @media ${t.mobile} { max-height: calc(100vh - 210px); }
`;

const GridWrap = styled.div`
  display: grid;
  grid-template-columns: ${GUTTER}px repeat(${(p) => p.$cols}, minmax(${(p) => p.$min}px, 1fr));
  min-width: fit-content;
`;

const HeadCell = styled.div`
  position: sticky;
  top: 0;
  z-index: 6;
  background: #fff;
  border-bottom: 1px solid ${t.border};
  border-left: 1px solid ${t.border};
  padding: 8px 6px;
  text-align: center;
  font-size: 13px;
  line-height: 1.25;
  min-height: 48px;
  ${(p) => p.$corner && 'left: 0; z-index: 7; border-left: none;'}
  ${(p) => p.$hoy && `color: ${t.primary};`}
  strong { display: block; font-weight: 600; }
  small { color: ${t.muted}; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  span.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; }
`;

const Gutter = styled.div`
  position: sticky;
  left: 0;
  z-index: 5;
  background: #fff;
  height: ${(p) => p.$h}px;
  div {
    position: absolute;
    right: 8px;
    transform: translateY(-50%);
    font-size: 11px;
    color: ${t.muted};
    font-variant-numeric: tabular-nums;
  }
`;

const Columna = styled.div`
  position: relative;
  height: ${(p) => p.$h}px;
  border-left: 1px solid ${t.border};
  /* Fuera del horario de atención: rayado gris bien visible */
  background: repeating-linear-gradient(135deg, #cbd5e1 0, #cbd5e1 5px, #e2e8f0 5px, #e2e8f0 11px);
  cursor: copy;
`;

const Lineas = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
  background-image: repeating-linear-gradient(
    to bottom,
    ${t.border} 0,
    ${t.border} 1px,
    transparent 1px,
    transparent ${30 * PPM}px
  );
  background-position-y: ${(p) => p.$offset}px;
  opacity: 0.8;
`;

const Franja = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  background: #fff;
  box-shadow: inset 0 1px 0 #94a3b8, inset 0 -1px 0 #94a3b8;
  z-index: 1;
`;

const Bloqueo = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  z-index: 3;
  background: repeating-linear-gradient(135deg, #fca5a5 0, #fca5a5 6px, #fecaca 6px, #fecaca 13px);
  border-top: 2px solid #dc2626;
  border-bottom: 2px solid #dc2626;
  border-left: 4px solid #dc2626;
  overflow: hidden;
  pointer-events: none;
  span {
    display: inline-block;
    margin: 4px 6px;
    padding: 2px 8px;
    border-radius: 999px;
    background: #dc2626;
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    text-transform: capitalize;
    white-space: nowrap;
    max-width: calc(100% - 12px);
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const Bloque = styled.button`
  position: absolute;
  z-index: 4;
  text-align: left;
  border: none;
  border-left: 4px solid ${(p) => p.$prof};
  border-radius: 6px;
  padding: 3px 6px;
  overflow: hidden;
  cursor: pointer;
  background: ${(p) => p.$estado}22;
  box-shadow: inset 0 0 0 1px ${(p) => p.$estado}55, 0 1px 2px rgba(15, 23, 42, 0.06);
  font-size: 12px;
  line-height: 1.3;
  color: ${t.text};
  opacity: ${(p) => (p.$apagado ? 0.6 : 1)};
  &:hover { box-shadow: inset 0 0 0 1px ${(p) => p.$estado}, 0 4px 12px rgba(15, 23, 42, 0.15); z-index: 5; }
  strong { font-weight: 600; }
  .hora { color: ${t.muted}; font-variant-numeric: tabular-nums; }
  .chip { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: ${(p) => p.$estado}; margin-right: 4px; }
  div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;

const Ahora = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: #ef4444;
  z-index: 6;
  pointer-events: none;
  &::before {
    content: '';
    position: absolute;
    left: -5px;
    top: -4px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #ef4444;
  }
`;

// Distribuye turnos superpuestos en carriles para que no se tapen.
function carriles(turnos) {
  const items = turnos
    .map((tu) => ({ tu, a: aMin(tu.inicio.slice(11, 16)), b: aMin(tu.fin.slice(11, 16)) }))
    .sort((x, y) => x.a - y.a || y.b - x.b);
  const out = [];
  let grupo = [];
  let finGrupo = -1;
  const cerrar = () => {
    const lanes = [];
    for (const it of grupo) {
      let i = lanes.findIndex((fin) => fin <= it.a);
      if (i === -1) i = lanes.length;
      lanes[i] = it.b;
      it.lane = i;
    }
    for (const it of grupo) out.push({ ...it, total: lanes.length });
  };
  for (const it of items) {
    if (grupo.length && it.a >= finGrupo) {
      cerrar();
      grupo = [];
      finGrupo = -1;
    }
    grupo.push(it);
    finGrupo = Math.max(finGrupo, it.b);
  }
  if (grupo.length) cerrar();
  return out;
}

function useMinutoActual() {
  const [m, setM] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setM(d.getHours() * 60 + d.getMinutes());
    }, 60000);
    return () => clearInterval(id);
  }, []);
  return m;
}

/**
 * Grilla horaria para vistas de día y semana.
 * columnas: [{ key, fecha, titulo, subtitulo, color, profIds: [] }]
 */
export default function GrillaAgenda({ columnas, datos, estados, profesionales, onNuevo, onAbrir, minWidth = 140 }) {
  const scrollRef = useRef(null);
  const minutoActual = useMinutoActual();
  const fechaHoy = hoy();
  const colorProf = useMemo(() => Object.fromEntries(profesionales.map((p) => [p.id, p.color])), [profesionales]);
  const pasoProf = useMemo(() => Object.fromEntries(profesionales.map((p) => [p.id, Number(p.duracion_turno_min) || 30])), [profesionales]);

  const cols = useMemo(
    () =>
      columnas.map((c) => {
        const franjas = [];
        const bloqueos = [];
        for (const pid of c.profIds) {
          const d = datos.disponibilidad?.[pid]?.[c.fecha];
          if (!d) continue;
          franjas.push(...d.franjas.map((f) => [aMin(f.desde), f.hasta === '24:00' ? 1440 : aMin(f.hasta)]));
          for (const b of d.bloqueos) {
            // En columnas con varios profesionales solo se marcan bloqueos que afectan a todos.
            if (c.profIds.length > 1 && !b.dia_completo) continue;
            if (!bloqueos.some((x) => x.id === b.id)) bloqueos.push(b);
          }
        }
        const turnos = datos.turnos.filter((tu) => tu.inicio.startsWith(c.fecha) && c.profIds.includes(tu.profesional_id));
        return { ...c, franjas, bloqueos, turnos: carriles(turnos) };
      }),
    [columnas, datos]
  );

  // Rango horario visible: cubre todas las franjas y turnos, mínimo 08 a 18.
  const [desde, hasta] = useMemo(() => {
    let a = 8 * 60;
    let b = 18 * 60;
    for (const c of cols) {
      for (const [x, y] of c.franjas) {
        a = Math.min(a, x);
        b = Math.max(b, y);
      }
      for (const it of c.turnos) {
        a = Math.min(a, it.a);
        b = Math.max(b, it.b);
      }
    }
    return [Math.floor(a / 60) * 60, Math.min(1440, Math.ceil(b / 60) * 60)];
  }, [cols]);

  const alto = (hasta - desde) * PPM;
  const y = (min) => (min - desde) * PPM;

  // Al abrir, posiciona la vista cerca de la hora actual o del primer turno.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const tieneHoy = columnas.some((c) => c.fecha === fechaHoy);
    const objetivo = tieneHoy ? minutoActual - 60 : desde;
    el.scrollTop = Math.max(0, y(objetivo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnas.map((c) => c.key).join(), desde]);

  const click = (c) => (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const min = desde + (e.clientY - rect.top) / PPM;
    const paso = c.profIds.length === 1 ? pasoProf[c.profIds[0]] : 15;
    const snap = Math.floor(min / paso) * paso;
    // Si cae dentro de una franja, alinear a la grilla de esa franja.
    const fr = c.franjas.find(([x, yy]) => min >= x && min < yy);
    const hora = fr ? fr[0] + Math.floor((min - fr[0]) / paso) * paso : snap;
    onNuevo({ fecha: c.fecha, hora: aHora(hora), profesional_id: c.profIds.length === 1 ? c.profIds[0] : undefined });
  };

  const horas = [];
  for (let m = desde; m <= hasta; m += 60) horas.push(m);

  return (
    <Scroller ref={scrollRef}>
      <GridWrap $cols={cols.length} $min={minWidth}>
        <HeadCell $corner />
        {cols.map((c) => (
          <HeadCell key={c.key} $hoy={c.fecha === fechaHoy}>
            <strong>
              {c.color && <span className="dot" style={{ background: c.color }} />}
              {c.titulo}
            </strong>
            {c.subtitulo && <small>{c.subtitulo}</small>}
          </HeadCell>
        ))}

        <Gutter $h={alto}>
          {horas.map((m) => (
            <div key={m} style={{ top: y(m) }}>
              {m < 1440 ? aHora(m) : ''}
            </div>
          ))}
        </Gutter>

        {cols.map((c) => (
          <Columna key={c.key} $h={alto} onClick={click(c)}>
            {c.franjas.map(([a, b], i) => (
              <Franja key={i} style={{ top: y(a), height: (b - a) * PPM }} />
            ))}
            <Lineas $offset={(30 - (desde % 30)) * PPM} />
            {c.bloqueos.map((b) => {
              const a = Math.max(aMin(b.desde), desde);
              const z = b.dia_completo ? hasta : Math.min(aMin(b.hasta), hasta);
              return (
                <Bloqueo key={b.id} style={{ top: y(a), height: Math.max((z - a) * PPM, 18) }}>
                  <span>{b.motivo || b.tipo.replace('_', ' ')}</span>
                </Bloqueo>
              );
            })}
            {c.turnos.map(({ tu, a, b, lane, total }) => {
              const h = Math.max((b - a) * PPM - 2, 16);
              const est = estados[tu.estado] || {};
              const ancho = 100 / total;
              return (
                <Bloque
                  key={tu.id}
                  $prof={colorProf[tu.profesional_id] || tu.prof_color}
                  $estado={est.color || '#64748b'}
                  $apagado={['atendido', 'ausente', 'cancelado'].includes(tu.estado)}
                  style={{ top: y(a) + 1, height: h, left: `calc(${lane * ancho}% + 2px)`, width: `calc(${ancho}% - 4px)` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAbrir(tu.id);
                  }}
                  title={`${tu.inicio.slice(11, 16)}–${tu.fin.slice(11, 16)} · ${tu.pac_apellido}, ${tu.pac_nombre}${tu.prestacion ? ` · ${tu.prestacion}` : ''} · ${est.etiqueta || tu.estado}${tu.sobreturno ? ' · Sobreturno' : ''}`}
                >
                  {h < 34 ? (
                    <div>
                      <span className="chip" />
                      <span className="hora">{tu.inicio.slice(11, 16)}</span> <strong>{tu.pac_apellido}</strong>
                    </div>
                  ) : (
                    <>
                      <div className="hora">
                        <span className="chip" />
                        {tu.inicio.slice(11, 16)}–{tu.fin.slice(11, 16)}
                        {!!tu.sobreturno && ' · ST'}
                      </div>
                      <div>
                        <strong>
                          {tu.pac_apellido}, {tu.pac_nombre}
                        </strong>
                      </div>
                      {h > 60 && tu.prestacion && <div className="hora">{tu.prestacion}</div>}
                      {h > 80 && c.profIds.length > 1 && (
                        <div className="hora">
                          {tu.prof_apellido}
                        </div>
                      )}
                    </>
                  )}
                </Bloque>
              );
            })}
            {c.fecha === fechaHoy && minutoActual >= desde && minutoActual <= hasta && <Ahora style={{ top: y(minutoActual) }} />}
          </Columna>
        ))}
      </GridWrap>
    </Scroller>
  );
}
