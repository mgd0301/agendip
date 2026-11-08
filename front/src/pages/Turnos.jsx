import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FaWhatsapp } from 'react-icons/fa';
import { FiSearch } from 'react-icons/fi';
import api, { errorMsg } from '../api';
import { useAuth } from '../context/AuthContext';
import { useDatos } from '../context/DatosContext';
import { Badge, Button, Dot, Empty, Field, Grid, Input, Muted, Page, PageHeader, Pagination, SearchBox, Select, Spinner, Table, TableWrap, useFocoInicial } from '../components/ui';
import { DIAS_CORTOS, diaSemana, fechaCorta, hoy } from '../utils/fechas';
import TurnoModal from './agenda/TurnoModal';
import EnviarAgendaModal from '../components/EnviarAgendaModal';

export default function Turnos() {
  const buscador = useRef(null);
  useFocoInicial(buscador);
  const { usuario } = useAuth();
  const { profesionales, estados } = useDatos();
  const [filtros, setFiltros] = useState({ q: '', estado: '', profesional_id: '', desde: '', hasta: '', orden: 'desc' });
  const [page, setPage] = useState(1);
  const [res, setRes] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(() => {
    api
      .get('/turnos', { params: { ...filtros, page, limit: 30 } })
      .then((r) => setRes(r.data))
      .catch((err) => toast.error(errorMsg(err)));
  }, [filtros, page]);

  useEffect(() => {
    const id = setTimeout(cargar, 250);
    return () => clearTimeout(id);
  }, [cargar]);

  const set = (k) => (e) => {
    setFiltros({ ...filtros, [k]: e.target.value });
    setPage(1);
  };

  return (
    <Page>
      <PageHeader title="Turnos" subtitle="Búsqueda y listado de turnos">
        <Button $variant="secondary" onClick={() => setEnviando(true)}>
          <FaWhatsapp /> Enviar agenda
        </Button>
      </PageHeader>
      <Grid $cols={3} style={{ marginBottom: 12, alignItems: 'end' }}>
        <Field label="Paciente">
          <SearchBox ref={buscador}>
            <FiSearch />
            <Input placeholder="Nombre, DNI o teléfono" value={filtros.q} onChange={set('q')} />
          </SearchBox>
        </Field>
        {usuario.rol !== 'profesional' && (
          <Field label="Profesional">
            <Select value={filtros.profesional_id} onChange={set('profesional_id')}>
              <option value="">Todos</option>
              {profesionales.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.apellido}, {p.nombre}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Estado">
          <Select value={filtros.estado} onChange={set('estado')}>
            <option value="">Todos</option>
            {Object.entries(estados).map(([k, e]) => (
              <option key={k} value={k}>
                {e.etiqueta}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Desde">
          <Input type="date" value={filtros.desde} onChange={set('desde')} />
        </Field>
        <Field label="Hasta">
          <Input type="date" value={filtros.hasta} onChange={set('hasta')} />
        </Field>
        <Field label="Orden">
          <Select value={filtros.orden} onChange={set('orden')}>
            <option value="desc">Más recientes</option>
            <option value="asc">Más antiguos</option>
          </Select>
        </Field>
      </Grid>
      <TableWrap>
        {!res ? (
          <Spinner />
        ) : !res.items.length ? (
          <Empty>No hay turnos con esos filtros</Empty>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Paciente</th>
                  <th>Profesional</th>
                  <th>Prestación</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {res.items.map((tu) => {
                  const f = tu.inicio.slice(0, 10);
                  return (
                    <tr key={tu.id} data-click onClick={() => setAbierto(tu.id)}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {DIAS_CORTOS[diaSemana(f)]} {fechaCorta(f)} · <strong>{tu.inicio.slice(11, 16)}</strong>
                        <Muted $size="12px"> ({tu.duracion_min} min)</Muted>
                        {tu.sobreturno ? <Badge $color="#ea580c" style={{ marginLeft: 6 }}>Sobreturno</Badge> : null}
                      </td>
                      <td>
                        {tu.pac_apellido}, {tu.pac_nombre}
                        {tu.pac_telefono && <Muted $size="12px"> · {tu.pac_telefono}</Muted>}
                      </td>
                      <td>
                        <Dot $color={tu.prof_color} /> {tu.prof_apellido}, {tu.prof_nombre}
                      </td>
                      <td>{tu.prestacion || '—'}</td>
                      <td>
                        <Badge $color={estados[tu.estado]?.color}>{estados[tu.estado]?.etiqueta || tu.estado}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination page={res.page} total={res.total} limit={res.limit} onChange={setPage} />
          </>
        )}
      </TableWrap>
      {abierto && (
        <TurnoModal
          key={abierto}
          turnoId={abierto}
          onClose={() => setAbierto(null)}
          onSaved={(_, op = {}) => {
            cargar();
            if (op.cerrar !== false) setAbierto(null);
          }}
        />
      )}
      {enviando && (
        <EnviarAgendaModal
          profesionalId={Number(filtros.profesional_id) || undefined}
          desde={filtros.desde || hoy()}
          hasta={filtros.hasta || filtros.desde || hoy()}
          onClose={() => setEnviando(false)}
        />
      )}
    </Page>
  );
}
