import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiSearch, FiTrash2 } from 'react-icons/fi';
import api, { errorMsg } from '../api';
import { useDatos } from '../context/DatosContext';
import {
  Badge, Button, Empty, Field, Grid, Input, Modal, Muted, Page, PageHeader, Pagination, Row, SearchBox, Select, Spinner, Tab, Table, TableWrap, Tabs, Textarea,
  useFocoInicial,
} from '../components/ui';
import { edad, fechaCorta, fechaHora } from '../utils/fechas';
import { confirmar } from '../utils/confirmar';

const VACIO = {
  nombre: '', apellido: '', dni: '', fecha_nacimiento: '', sexo: '', telefono: '', email: '', direccion: '', obra_social_id: '', plan_id: '', nro_afiliado: '', observaciones: '', campos: {},
};

function CampoExtra({ campo, value, onChange }) {
  const props = { value: value ?? '', onChange: (e) => onChange(e.target.value) };
  if (campo.tipo === 'numero') return <Input type="number" {...props} />;
  if (campo.tipo === 'fecha') return <Input type="date" {...props} />;
  if (campo.tipo === 'si_no')
    return (
      <Select {...props}>
        <option value="">—</option>
        <option value="Sí">Sí</option>
        <option value="No">No</option>
      </Select>
    );
  if (campo.tipo === 'opcion')
    return (
      <Select {...props}>
        <option value="">—</option>
        {(campo.opciones || '').split('|').map((o) => o.trim()).filter(Boolean).map((o) => (
          <option key={o}>{o}</option>
        ))}
      </Select>
    );
  return <Input {...props} />;
}

function PacienteModal({ id, onClose, onSaved }) {
  const { estados, obrasSociales } = useDatos();
  const [form, setForm] = useState(VACIO);
  // Nombres actuales del paciente, por si su obra social o plan ya fueron dados de baja.
  const [cobertura, setCobertura] = useState({});
  const [campos, setCampos] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [tab, setTab] = useState('datos');
  const [cargando, setCargando] = useState(!!id);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api.get('/config/campos-paciente').then((r) => setCampos(r.data)).catch(() => {});
    if (!id) return;
    Promise.all([api.get(`/pacientes/${id}`), api.get(`/pacientes/${id}/turnos`)])
      .then(([p, tu]) => {
        const d = p.data;
        setForm(Object.fromEntries(Object.keys(VACIO).map((k) => [k, d[k] ?? (k === 'campos' ? {} : '')])));
        setCobertura({ obra_social: d.obra_social, plan: d.plan, obra_social_id: d.obra_social_id, plan_id: d.plan_id });
        setTurnos(tu.data);
      })
      .catch((err) => toast.error(errorMsg(err)))
      .finally(() => setCargando(false));
  }, [id]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const guardar = async (e) => {
    e?.preventDefault();
    setGuardando(true);
    try {
      if (id) await api.put(`/pacientes/${id}`, form);
      else await api.post('/pacientes', form);
      toast.success('Paciente guardado');
      onSaved();
    } catch (err) {
      toast.error(errorMsg(err));
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    const ok = await confirmar({
      tipo: 'peligro',
      titulo: '¿Dar de baja al paciente?',
      mensaje: 'Deja de aparecer en las búsquedas. Su historial de turnos se conserva.',
      aceptar: 'Dar de baja',
    });
    if (!ok) return;
    try {
      await api.delete(`/pacientes/${id}`);
      toast.success('Paciente dado de baja');
      onSaved();
    } catch (err) {
      toast.error(errorMsg(err));
    }
  };

  const os = obrasSociales.find((o) => o.id === Number(form.obra_social_id));
  const planes = os?.planes || [];
  const osDadaDeBaja = form.obra_social_id && !os && Number(form.obra_social_id) === cobertura.obra_social_id;
  const planDadoDeBaja = form.plan_id && !planes.some((p) => p.id === Number(form.plan_id)) && Number(form.plan_id) === cobertura.plan_id;

  const proximos = turnos.filter((tu) => tu.estado !== 'cancelado').length;

  return (
    <Modal
      title={id ? `${form.apellido}, ${form.nombre}` : 'Nuevo paciente'}
      onClose={onClose}
      width="680px"
      footer={
        <>
          {id && (
            <Button $variant="danger" onClick={eliminar} style={{ marginRight: 'auto' }}>
              <FiTrash2 /> Dar de baja
            </Button>
          )}
          <Button $variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          {tab === 'datos' && (
            <Button onClick={guardar} disabled={guardando}>
              Guardar
            </Button>
          )}
        </>
      }
    >
      {cargando ? (
        <Spinner />
      ) : (
        <>
          {id && (
            <Tabs>
              <Tab $active={tab === 'datos'} onClick={() => setTab('datos')}>
                Datos
              </Tab>
              <Tab $active={tab === 'turnos'} onClick={() => setTab('turnos')}>
                Historial de turnos ({turnos.length})
              </Tab>
            </Tabs>
          )}
          {tab === 'datos' ? (
            <form onSubmit={guardar}>
              <Grid>
                <Field label="Nombre *">
                  <Input value={form.nombre} onChange={set('nombre')} required />
                </Field>
                <Field label="Apellido *">
                  <Input value={form.apellido} onChange={set('apellido')} required />
                </Field>
                <Field label="DNI">
                  <Input value={form.dni} onChange={set('dni')} inputMode="numeric" />
                </Field>
                <Field label={`Fecha de nacimiento${form.fecha_nacimiento ? ` (${edad(form.fecha_nacimiento)} años)` : ''}`}>
                  <Input type="date" value={form.fecha_nacimiento} onChange={set('fecha_nacimiento')} />
                </Field>
                <Field label="Teléfono (WhatsApp)">
                  <Input value={form.telefono} onChange={set('telefono')} inputMode="tel" placeholder="Ej: 351 6123456" />
                </Field>
                <Field label="Email">
                  <Input type="email" value={form.email} onChange={set('email')} />
                </Field>
                <Field label="Sexo">
                  <Select value={form.sexo} onChange={set('sexo')}>
                    <option value="">—</option>
                    <option value="F">Femenino</option>
                    <option value="M">Masculino</option>
                    <option value="X">X / Otro</option>
                  </Select>
                </Field>
                <Field label="Dirección">
                  <Input value={form.direccion} onChange={set('direccion')} />
                </Field>
                <Field label="Obra social / prepaga">
                  <Select value={form.obra_social_id} onChange={(e) => setForm({ ...form, obra_social_id: e.target.value, plan_id: '' })}>
                    <option value="">Particular (sin obra social)</option>
                    {obrasSociales.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nombre}
                      </option>
                    ))}
                    {osDadaDeBaja && <option value={form.obra_social_id}>{cobertura.obra_social} (dada de baja)</option>}
                  </Select>
                </Field>
                <Field label="Plan">
                  <Select value={form.plan_id} onChange={set('plan_id')} disabled={!planes.length && !planDadoDeBaja}>
                    <option value="">{!form.obra_social_id ? '—' : planes.length ? 'Sin especificar' : 'Sin planes cargados'}</option>
                    {planes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                    {planDadoDeBaja && <option value={form.plan_id}>{cobertura.plan} (dado de baja)</option>}
                  </Select>
                </Field>
                <Field label="Nº de afiliado">
                  <Input value={form.nro_afiliado} onChange={set('nro_afiliado')} />
                </Field>
                {campos.map((c) => (
                  <Field key={c.id} label={c.nombre}>
                    <CampoExtra campo={c} value={form.campos[c.id]} onChange={(v) => setForm({ ...form, campos: { ...form.campos, [c.id]: v } })} />
                  </Field>
                ))}
                <Field label="Observaciones" style={{ gridColumn: '1 / -1' }}>
                  <Textarea value={form.observaciones} onChange={set('observaciones')} rows={3} />
                </Field>
              </Grid>
              <button type="submit" hidden />
            </form>
          ) : (
            <>
              <Muted>{proximos} turnos no cancelados</Muted>
              <Table style={{ marginTop: 8 }}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Profesional</th>
                    <th>Prestación</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {turnos.map((tu) => (
                    <tr key={tu.id}>
                      <td>{fechaHora(tu.inicio)}</td>
                      <td>
                        {tu.prof_apellido}, {tu.prof_nombre}
                      </td>
                      <td>{tu.prestacion || '—'}</td>
                      <td>
                        <Badge $color={estados[tu.estado]?.color}>{estados[tu.estado]?.etiqueta}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {!turnos.length && <Empty>Sin turnos registrados</Empty>}
            </>
          )}
        </>
      )}
    </Modal>
  );
}

export default function Pacientes() {
  const buscador = useRef(null);
  useFocoInicial(buscador);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [res, setRes] = useState(null);
  const [modal, setModal] = useState(null);

  const cargar = useCallback(() => {
    api
      .get('/pacientes', { params: { q, page, limit: 25 } })
      .then((r) => setRes(r.data))
      .catch((err) => toast.error(errorMsg(err)));
  }, [q, page]);

  useEffect(() => {
    const id = setTimeout(cargar, 250);
    return () => clearTimeout(id);
  }, [cargar]);

  return (
    <Page>
      <PageHeader title="Pacientes" subtitle={res ? `${res.total} pacientes` : ''}>
        <Button onClick={() => setModal({ id: null })}>
          <FiPlus /> Nuevo paciente
        </Button>
      </PageHeader>
      <Row style={{ marginBottom: 12 }}>
        <SearchBox ref={buscador}>
          <FiSearch />
          <Input
            placeholder="Buscar por nombre, DNI, teléfono o email"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </SearchBox>
      </Row>
      <TableWrap>
        {!res ? (
          <Spinner />
        ) : res.items.length === 0 ? (
          <Empty>{q ? 'No se encontraron pacientes' : 'Todavía no hay pacientes cargados'}</Empty>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>DNI</th>
                  <th>Teléfono</th>
                  <th>Email</th>
                  <th>Obra social</th>
                </tr>
              </thead>
              <tbody>
                {res.items.map((p) => (
                  <tr key={p.id} data-click onClick={() => setModal({ id: p.id })}>
                    <td>
                      <strong>
                        {p.apellido}, {p.nombre}
                      </strong>
                      {p.fecha_nacimiento && (
                        <Muted $size="12px">
                          {' '}
                          · {edad(p.fecha_nacimiento)} años ({fechaCorta(p.fecha_nacimiento)})
                        </Muted>
                      )}
                    </td>
                    <td>{p.dni || '—'}</td>
                    <td>{p.telefono || '—'}</td>
                    <td>{p.email || '—'}</td>
                    <td>
                      {p.obra_social || '—'}
                      {p.plan && <Muted $size="12px"> · {p.plan}</Muted>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={res.page} total={res.total} limit={res.limit} onChange={setPage} />
          </>
        )}
      </TableWrap>
      {modal && (
        <PacienteModal
          id={modal.id}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            cargar();
          }}
        />
      )}
    </Page>
  );
}
