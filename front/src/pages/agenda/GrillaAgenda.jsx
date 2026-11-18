import { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { FiMoreVertical, FiVideo } from 'react-icons/fi';
import { aHora, aMin, hoy } from '../../utils/fechas';
import { theme as t } from '../../styles/GlobalStyle';
import { ALTURAS } from './alturas';

const GUTTER = 56;
// Solo se arrastran turnos que todavía no ocurrieron ni se cancelaron.
const ARRASTRABLES = ['pendiente', 'confirmado'];
const UMBRAL_ARRASTRE = 5; // px que hay que mover el mouse para que cuente como arrastre
const ESPERA_DEDO = 350; // ms manteniendo apretado con el dedo para levantar el turno
const TOLERANCIA_DEDO = 10; // px que se tolera mover el dedo durante esa espera
const MARGEN = 10; // px libres arriba y abajo para que la primera y la última hora se lean enteras
const HUECO_MIN = 120; // un hueco sin atención de al menos 2 horas se achica
const ALTO_HUECO = (min) => Math.min(48, Math.max(28, (min / 60) * 10)); // px que ocupa ese hueco

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
  ${(p) => p.$arrastrando && 'user-select: none; cursor: grabbing; * { cursor: grabbing !important; }'}
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
  left: 0;
  right: 0;
  pointer-events: none;
  z-index: 2;
  background-image: repeating-linear-gradient(
    to bottom,
    ${t.border} 0,
    ${t.border} 1px,
    transparent 1px,
    transparent ${(p) => 30 * p.$ppm}px
  );
  opacity: 0.8;
`;

// Hueco largo sin atención, achicado: una franja angosta con el rayado y un borde punteado.
const Hueco = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  z-index: 2;
  pointer-events: none;
  border-top: 1px dashed #94a3b8;
  border-bottom: 1px dashed #94a3b8;
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
  .virtual { vertical-align: -2px; margin-left: 4px; color: #0891b2; stroke-width: 2.5; }
  div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  /* Con mouse, el botón ⋮ aparece al pasar por encima; en pantallas táctiles queda siempre visible. */
  @media (hover: hover) {
    .puntos { opacity: 0; }
    &:hover .puntos, .puntos:focus-visible { opacity: 1; }
  }
`;

const Puntos = styled.span`
  position: absolute;
  top: 0;
  right: 0;
  width: 24px;
  height: 24px;
  max-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: ${t.muted};
  background: rgba(255, 255, 255, 0.75);
  &:hover { background: #fff; color: ${t.text}; }
`;

// Vista previa del lugar donde quedará el turno al soltarlo.
const Fantasma = styled.div`
  position: absolute;
  left: 2px;
  right: 2px;
  z-index: 7;
  pointer-events: none;
  border: 2px dashed ${t.primary};
  border-radius: 6px;
  background: ${t.primarySoft};
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.18);
  padding: 2px 6px;
  font-size: 12px;
  line-height: 1.3;
  color: ${t.primary};
  overflow: hidden;
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
export default function GrillaAgenda({ columnas, datos, estados, profesionales, onNuevo, onAbrir, onMover, onMenu, minWidth = 140, ppm = ALTURAS.normal }) {
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

  // Tramos de la escala vertical. Las horas en que no atiende nadie de la vista y no hay turnos,
  // si suman al menos HUECO_MIN seguidas, se achican para ver más horario de trabajo en pantalla.
  const tramos = useMemo(() => {
    const ocupada = (h) =>
      cols.some((c) => c.franjas.some(([x, yy]) => x < h + 60 && yy > h) || c.turnos.some((it) => it.a < h + 60 && it.b > h));
    // Un día sin atención ni turnos (franco, fin de semana) se muestra completo, sin achicar.
    let libre = true;
    for (let m = desde; m < hasta && libre; m += 60) libre = !ocupada(m);
    const out = [];
    let px = MARGEN;
    let h = desde;
    while (h < hasta) {
      let fin = h + 60;
      if (!ocupada(h)) while (fin < hasta && !ocupada(fin)) fin += 60;
      const hueco = !libre && !ocupada(h) && fin - h >= HUECO_MIN;
      if (!hueco) fin = h + 60;
      const k = hueco ? ALTO_HUECO(fin - h) / (fin - h) : ppm;
      const prev = out[out.length - 1];
      if (prev && !prev.hueco && !hueco) prev.b = fin;
      else out.push({ a: h, b: fin, px, k, hueco });
      px += (fin - h) * k;
      h = fin;
    }
    return out;
  }, [cols, desde, hasta, ppm]);

  const alto = tramos.reduce((t, r) => t + (r.b - r.a) * r.k, 0) + 2 * MARGEN;
  const tramoDe = (min) => tramos.find((r) => min < r.b) || tramos[tramos.length - 1];
  const y = (min) => {
    if (min <= desde) return MARGEN + (min - desde) * ppm;
    const r = tramoDe(min);
    return r.px + (Math.min(min, r.b) - r.a) * r.k + Math.max(0, min - r.b) * ppm;
  };
  // Inversa de y: de píxeles (desde el borde de la columna) a minutos.
  const minDeY = (py) => {
    if (py <= MARGEN) return desde - (MARGEN - py) / ppm;
    for (const r of tramos) {
      const fin = r.px + (r.b - r.a) * r.k;
      if (py < fin) return r.a + (py - r.px) / r.k;
    }
    return hasta + (py - alto + MARGEN) / ppm;
  };

  // Al abrir, posiciona la vista cerca de la hora actual o del primer turno.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const tieneHoy = columnas.some((c) => c.fecha === fechaHoy);
    const objetivo = tieneHoy ? minutoActual - 60 : desde;
    el.scrollTop = Math.max(0, y(objetivo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnas.map((c) => c.key).join(), desde, ppm, tramos.length]);

  // Ajusta un minuto a la grilla del profesional; dentro de una franja, alineado al inicio de esa franja.
  const ajustar = (c, min, pid, redondear = Math.floor) => {
    const paso = pid ? pasoProf[pid] : 15;
    const fr = c.franjas.find(([x, yy]) => min >= x && min < yy);
    return fr ? fr[0] + redondear((min - fr[0]) / paso) * paso : redondear(min / paso) * paso;
  };

  // ----- Arrastrar y soltar para reprogramar -----
  const [presion, setPresion] = useState(null); // { tu, x, y, offset, dur } desde que se aprieta el mouse
  const [arrastre, setArrastre] = useState(null); // { id, col, ini } mientras se arrastra
  const destino = useRef(null);
  const recienSoltado = useRef(false);
  const conDedo = useRef(false);

  // Mientras se arrastra con el dedo, la grilla no se desplaza. El listener tiene que existir
  // desde antes de tocar la pantalla y no ser pasivo, si no el navegador ignora el preventDefault.
  useEffect(() => {
    const el = scrollRef.current;
    const bloquear = (e) => conDedo.current && e.preventDefault();
    el.addEventListener('touchmove', bloquear, { passive: false });
    return () => el.removeEventListener('touchmove', bloquear);
  }, []);

  useEffect(() => {
    if (!presion) return;
    const { tu } = presion;
    const terminar = () => {
      destino.current = null;
      conDedo.current = false;
      setPresion(null);
      setArrastre(null);
    };
    const mover = (e) => {
      if (!destino.current && Math.hypot(e.clientX - presion.x, e.clientY - presion.y) < UMBRAL_ARRASTRE) return;
      // Cerca del borde de la grilla, se desplaza sola.
      const sc = scrollRef.current;
      const r = sc.getBoundingClientRect();
      if (e.clientY > r.bottom - 40) sc.scrollTop += 14;
      else if (e.clientY < r.top + 70) sc.scrollTop -= 14;

      const colEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-col]');
      const i = colEl ? Number(colEl.dataset.col) : -1;
      const c = cols[i];
      // Columna de un profesional: pasa a ese profesional. Columna de varios: se mantiene el del turno.
      const pid = !c ? null : c.profIds.length === 1 ? c.profIds[0] : c.profIds.includes(tu.profesional_id) ? tu.profesional_id : null;
      if (!pid) {
        destino.current = { nada: true };
        setArrastre({ id: tu.id, col: -1 });
        return;
      }
      const min = minDeY(e.clientY - colEl.getBoundingClientRect().top) - presion.offset;
      const ini = Math.min(Math.max(desde, ajustar(c, min, pid, Math.round)), 1440 - presion.dur);
      destino.current = { fecha: c.fecha, hora: aHora(ini), profesional_id: pid };
      setArrastre({ id: tu.id, col: i, ini });
    };
    const soltar = () => {
      const d = destino.current;
      if (d) {
        // El click que el navegador dispara al soltar no debe abrir el turno ni crear uno nuevo.
        recienSoltado.current = true;
        setTimeout(() => (recienSoltado.current = false), 0);
        const igual = d.fecha === tu.inicio.slice(0, 10) && d.hora === tu.inicio.slice(11, 16) && d.profesional_id === tu.profesional_id;
        if (!d.nada && !igual) onMover(tu, d);
      }
      terminar();
    };
    const tecla = (e) => e.key === 'Escape' && terminar();
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', terminar);
    window.addEventListener('keydown', tecla);
    return () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', terminar);
      window.removeEventListener('keydown', tecla);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presion, cols, desde, ppm, tramos]);

  const apretar = (tu, a, b) => (e) => {
    if (!onMover || !ARRASTRABLES.includes(tu.estado)) return;
    const r = e.currentTarget.getBoundingClientRect();
    const datos = { tu, x: e.clientX, y: e.clientY, offset: (e.clientY - r.top) / ppm, dur: b - a };
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
      if (e.button === 0) setPresion(datos);
      return;
    }
    // Con el dedo, deslizar desplaza la grilla; mantener apretado un instante levanta el turno.
    const x0 = e.clientX;
    const y0 = e.clientY;
    const cancelar = () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', siMueve);
      window.removeEventListener('pointerup', cancelar);
      window.removeEventListener('pointercancel', cancelar);
    };
    const siMueve = (ev) => Math.hypot(ev.clientX - x0, ev.clientY - y0) > TOLERANCIA_DEDO && cancelar();
    const timer = setTimeout(() => {
      cancelar();
      conDedo.current = true;
      destino.current = { nada: true }; // ya cuenta como arrastre, aunque el dedo no se haya movido
      navigator.vibrate?.(30);
      setPresion(datos);
      setArrastre({ id: tu.id, col: -1 });
    }, ESPERA_DEDO);
    window.addEventListener('pointermove', siMueve);
    window.addEventListener('pointerup', cancelar);
    window.addEventListener('pointercancel', cancelar);
  };

  const click = (c) => (e) => {
    if (recienSoltado.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const min = minDeY(e.clientY - rect.top);
    const pid = c.profIds.length === 1 ? c.profIds[0] : undefined;
    onNuevo({ fecha: c.fecha, hora: aHora(ajustar(c, min, pid)), profesional_id: pid });
  };

  const horas = [];
  for (let m = desde; m <= hasta; m += 60) if (!tramos.some((r) => r.hueco && m > r.a && m < r.b)) horas.push(m);

  return (
    <Scroller ref={scrollRef}>
      <GridWrap $cols={cols.length} $min={minWidth} $arrastrando={!!arrastre}>
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

        {cols.map((c, i) => (
          <Columna key={c.key} $h={alto} onClick={click(c)} data-col={i}>
            {c.franjas.map(([a, b], i) => (
              <Franja key={i} style={{ top: y(a), height: y(b) - y(a) }} />
            ))}
            {tramos.map((r) =>
              r.hueco ? (
                <Hueco key={r.a} style={{ top: y(r.a), height: y(r.b) - y(r.a) }} />
              ) : (
                <Lineas key={r.a} $ppm={ppm} style={{ top: y(r.a), height: y(r.b) - y(r.a) }} />
              )
            )}
            {c.bloqueos.map((b) => {
              const a = Math.max(aMin(b.desde), desde);
              const z = b.dia_completo ? hasta : Math.min(aMin(b.hasta), hasta);
              return (
                <Bloqueo key={b.id} style={{ top: y(a), height: Math.max(y(z) - y(a), 18) }}>
                  <span>{b.motivo || b.tipo.replace('_', ' ')}</span>
                </Bloqueo>
              );
            })}
            {c.turnos.map(({ tu, a, b, lane, total }) => {
              const h = Math.max(y(b) - y(a) - 2, 16);
              const est = estados[tu.estado] || {};
              const virtual = !!Number(tu.es_virtual) && <FiVideo className="virtual" aria-label="Virtual" />;
              const ancho = 100 / total;
              return (
                <Bloque
                  key={tu.id}
                  $prof={colorProf[tu.profesional_id] || tu.prof_color}
                  $estado={est.color || '#64748b'}
                  $apagado={['atendido', 'ausente', 'cancelado'].includes(tu.estado)}
                  style={{
                    top: y(a) + 1,
                    height: h,
                    padding: h < 24 ? '1px 6px' : undefined,
                    paddingRight: onMenu ? 24 : undefined,
                    left: `calc(${lane * ancho}% + 2px)`,
                    width: `calc(${ancho}% - 4px)`,
                    opacity: arrastre?.id === tu.id ? 0.35 : undefined,
                    outline: arrastre?.id === tu.id ? `2px dashed ${t.primary}` : undefined,
                    cursor: onMover && ARRASTRABLES.includes(tu.estado) ? 'grab' : undefined,
                  }}
                  onPointerDown={apretar(tu, a, b)}
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!recienSoltado.current) onAbrir(tu.id);
                  }}
                  title={`${tu.inicio.slice(11, 16)}–${tu.fin.slice(11, 16)} · ${tu.pac_apellido}, ${tu.pac_nombre}${tu.prestacion ? ` · ${tu.prestacion}` : ''} · ${est.etiqueta || tu.estado}${tu.sobreturno ? ' · Sobreturno' : ''}${Number(tu.es_virtual) ? ' · Virtual' : ''}`}
                >
                  {onMenu && (
                    <Puntos
                      className="puntos"
                      role="button"
                      tabIndex={0}
                      aria-label="Acciones del turno"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        const r = e.currentTarget.getBoundingClientRect();
                        onMenu(tu, { x: r.left, y: r.bottom + 4 });
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter' && e.key !== ' ') return;
                        e.preventDefault();
                        e.stopPropagation();
                        const r = e.currentTarget.getBoundingClientRect();
                        onMenu(tu, { x: r.left, y: r.bottom + 4 });
                      }}
                    >
                      <FiMoreVertical size={15} />
                    </Puntos>
                  )}
                  {h < 34 ? (
                    <div>
                      <span className="chip" />
                      <span className="hora">{tu.inicio.slice(11, 16)}</span> {virtual} <strong>{tu.pac_apellido}</strong>
                    </div>
                  ) : (
                    <>
                      <div className="hora">
                        <span className="chip" />
                        {tu.inicio.slice(11, 16)}–{tu.fin.slice(11, 16)}
                        {!!tu.sobreturno && ' · ST'}
                        {virtual}
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
            {arrastre?.col === i && presion && (
              <Fantasma style={{ top: y(arrastre.ini) + 1, height: Math.max(y(arrastre.ini + presion.dur) - y(arrastre.ini) - 2, 16) }}>
                <div>
                  <strong>
                    {aHora(arrastre.ini)}–{aHora(arrastre.ini + presion.dur)}
                  </strong>{' '}
                  {presion.tu.pac_apellido}
                </div>
              </Fantasma>
            )}
            {c.fecha === fechaHoy && minutoActual >= desde && minutoActual <= hasta && <Ahora style={{ top: y(minutoActual) }} />}
          </Columna>
        ))}
      </GridWrap>
    </Scroller>
  );
}
