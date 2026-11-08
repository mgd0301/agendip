import styled from 'styled-components';
import { DIAS_CORTOS, hoy, rango, sumarDias } from '../../utils/fechas';
import { theme as t } from '../../styles/GlobalStyle';

const Mes = styled.div`
  background: #fff;
  border: 1px solid ${t.border};
  border-radius: ${t.radius};
  overflow: hidden;
`;

const Cabecera = styled.div`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  background: #f8fafc;
  border-bottom: 1px solid ${t.border};
  div { padding: 8px; text-align: center; font-size: 12px; font-weight: 600; color: ${t.muted}; }
`;

const Celdas = styled.div`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  grid-auto-rows: minmax(108px, auto);
  @media ${t.mobile} { grid-auto-rows: minmax(70px, auto); }
`;

const Celda = styled.button`
  border: none;
  border-right: 1px solid ${t.border};
  border-bottom: 1px solid ${t.border};
  background: ${(p) =>
    p.$feriado
      ? 'repeating-linear-gradient(135deg, #fecaca 0 6px, #fee2e2 6px 12px)'
      : p.$laboral
        ? '#fff'
        : 'repeating-linear-gradient(135deg, #e2e8f0 0 5px, #f1f5f9 5px 10px)'};
  text-align: left;
  padding: 6px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  opacity: ${(p) => (p.$fuera ? 0.45 : 1)};
  &:nth-child(7n) { border-right: none; }
  &:hover { background: ${t.primarySoft}; }
  .num {
    font-weight: 600;
    font-size: 13px;
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    ${(p) => p.$hoy && `background: ${t.primary}; color: #fff;`}
  }
  .feriado {
    font-size: 11px;
    font-weight: 600;
    color: #fff;
    background: #dc2626;
    border-radius: 999px;
    padding: 1px 7px;
    align-self: flex-start;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .turno {
    font-size: 11.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .turno i { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .mas { font-size: 11px; color: ${t.muted}; }
  .total { display: none; }
  @media ${t.mobile} {
    .turno, .mas, .feriado { display: none; }
    .total { display: inline-block; font-size: 11px; background: ${t.primarySoft}; color: ${t.primary}; border-radius: 999px; padding: 1px 7px; }
  }
`;

export default function VistaMes({ fecha, desde, datos, profIds, estados, onDia }) {
  const mes = fecha.slice(0, 7);
  const dias = rango(desde, sumarDias(desde, 41));
  const fechaHoy = hoy();

  return (
    <Mes>
      <Cabecera>
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <div key={d}>{DIAS_CORTOS[d]}</div>
        ))}
      </Cabecera>
      <Celdas>
        {dias.map((f) => {
          const turnos = datos.turnos.filter((tu) => tu.inicio.startsWith(f));
          const disp = profIds.map((id) => datos.disponibilidad?.[id]?.[f]).filter(Boolean);
          const laboral = disp.some((d) => d.franjas.length);
          const feriado = disp.flatMap((d) => d.bloqueos).find((b) => b.dia_completo);
          return (
            <Celda key={f} $fuera={!f.startsWith(mes)} $hoy={f === fechaHoy} $laboral={laboral} $feriado={!!feriado} onClick={() => onDia(f)}>
              <span className="num">{Number(f.slice(8))}</span>
              {feriado && <span className="feriado">{feriado.motivo || feriado.tipo}</span>}
              {turnos.slice(0, 3).map((tu) => (
                <span className="turno" key={tu.id}>
                  <i style={{ background: estados[tu.estado]?.color }} />
                  {tu.inicio.slice(11, 16)} {tu.pac_apellido}
                </span>
              ))}
              {turnos.length > 3 && <span className="mas">+{turnos.length - 3} más</span>}
              {turnos.length > 0 && <span className="total">{turnos.length}</span>}
            </Celda>
          );
        })}
      </Celdas>
    </Mes>
  );
}
