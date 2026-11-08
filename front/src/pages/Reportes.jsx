import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import api, { errorMsg } from '../api';
import { useDatos } from '../context/DatosContext';
import { Card, Dot, Empty, Field, Input, Muted, Page, PageHeader, Row, Segmented, Spinner, Table, TableWrap } from '../components/ui';
import { finMes, hoy, inicioMes, inicioSemana, sumarDias, sumarMeses } from '../utils/fechas';
import { theme as t } from '../styles/GlobalStyle';

const Kpis = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
  strong { display: block; font-size: 26px; margin-top: 4px; }
`;

const Barra = styled.div`
  height: 8px;
  border-radius: 4px;
  background: #e2e8f0;
  overflow: hidden;
  min-width: 80px;
  div { height: 100%; background: ${(p) => p.$color || t.primary}; }
`;

const PERIODOS = [
  ['semana', 'Esta semana'],
  ['mes', 'Este mes'],
  ['anterior', 'Mes anterior'],
  ['otro', 'Otro'],
];

function rangoPeriodo(p) {
  const h = hoy();
  if (p === 'semana') return [inicioSemana(h), sumarDias(inicioSemana(h), 6)];
  if (p === 'anterior') {
    const m = sumarMeses(inicioMes(h), -1);
    return [m, finMes(m)];
  }
  return [inicioMes(h), finMes(h)];
}

const horas = (min) => `${Math.round((min / 60) * 10) / 10} h`;

export default function Reportes() {
  const { estados } = useDatos();
  const [periodo, setPeriodo] = useState('mes');
  const [rango, setRango] = useState(() => rangoPeriodo('mes'));
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    const [desde, hasta] = rango;
    if (!desde || !hasta || desde > hasta) return;
    api
      .get('/reportes/resumen', { params: { desde, hasta } })
      .then((r) => setDatos(r.data))
      .catch((err) => toast.error(errorMsg(err)));
  }, [rango]);

  const elegir = (p) => {
    setPeriodo(p);
    if (p !== 'otro') setRango(rangoPeriodo(p));
  };

  const totales = useMemo(() => {
    const tot = { total: 0, disp: 0, ocup: 0, por_estado: {} };
    for (const r of datos || []) {
      tot.total += r.total;
      tot.disp += r.minutos_disponibles;
      tot.ocup += r.minutos_ocupados;
      for (const [k, v] of Object.entries(r.por_estado)) tot.por_estado[k] = (tot.por_estado[k] || 0) + v;
    }
    return tot;
  }, [datos]);

  const cerrados = (totales.por_estado.atendido || 0) + (totales.por_estado.ausente || 0);
  const ausentismo = cerrados ? Math.round(((totales.por_estado.ausente || 0) / cerrados) * 100) : null;
  const estadosVisibles = Object.keys(estados);

  return (
    <Page>
      <PageHeader title="Reportes" subtitle="Turnos por estado y ocupación de agenda" />
      <Row $wrap style={{ marginBottom: 16, alignItems: 'end' }}>
        <Segmented>
          {PERIODOS.map(([v, l]) => (
            <button key={v} aria-pressed={periodo === v} onClick={() => elegir(v)}>
              {l}
            </button>
          ))}
        </Segmented>
        {periodo === 'otro' && (
          <>
            <Field label="Desde">
              <Input type="date" value={rango[0]} onChange={(e) => setRango([e.target.value, rango[1]])} />
            </Field>
            <Field label="Hasta">
              <Input type="date" value={rango[1]} onChange={(e) => setRango([rango[0], e.target.value])} />
            </Field>
          </>
        )}
      </Row>

      {!datos ? (
        <Spinner />
      ) : !datos.length ? (
        <Empty>No hay profesionales para mostrar</Empty>
      ) : (
        <>
          <Kpis>
            <Card>
              <Muted>Turnos en el período</Muted>
              <strong>{totales.total}</strong>
            </Card>
            <Card>
              <Muted>Atendidos</Muted>
              <strong>{totales.por_estado.atendido || 0}</strong>
            </Card>
            <Card>
              <Muted>Cancelados</Muted>
              <strong>{totales.por_estado.cancelado || 0}</strong>
            </Card>
            <Card>
              <Muted>Ausentismo</Muted>
              <strong>{ausentismo == null ? '—' : `${ausentismo}%`}</strong>
            </Card>
            <Card>
              <Muted>Ocupación de agenda</Muted>
              <strong>{totales.disp ? `${Math.round((totales.ocup / totales.disp) * 100)}%` : '—'}</strong>
            </Card>
          </Kpis>

          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th>Profesional</th>
                  {estadosVisibles.map((k) => (
                    <th key={k}>{estados[k].etiqueta}</th>
                  ))}
                  <th>Total</th>
                  <th>Horas ocupadas / disponibles</th>
                  <th>Ocupación</th>
                </tr>
              </thead>
              <tbody>
                {datos.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Dot $color={r.color} /> {r.apellido}, {r.nombre}
                    </td>
                    {estadosVisibles.map((k) => (
                      <td key={k}>{r.por_estado[k] || 0}</td>
                    ))}
                    <td>
                      <strong>{r.total}</strong>
                    </td>
                    <td>
                      {horas(r.minutos_ocupados)} / {horas(r.minutos_disponibles)}
                    </td>
                    <td>
                      {r.ocupacion == null ? (
                        <Muted>sin horario</Muted>
                      ) : (
                        <Row>
                          <Barra $color={r.color}>
                            <div style={{ width: `${Math.min(r.ocupacion, 100)}%` }} />
                          </Barra>
                          {r.ocupacion}%
                        </Row>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
          <Muted $size="12px" style={{ display: 'block', marginTop: 8 }}>
            La ocupación compara los minutos de turnos no cancelados contra los minutos de atención disponibles (horario habitual menos feriados y
            bloqueos). Puede superar el 100% si hubo sobreturnos.
          </Muted>
        </>
      )}
    </Page>
  );
}
