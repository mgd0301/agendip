import { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import api, { errorMsg } from '../api';
import { useDatos } from '../context/DatosContext';
import { Badge, Button, Card, Check, Empty, Field, Grid, IconButton, Input, Muted, Page, PageHeader, Row, Select, Spinner, Tab, Tabs, Textarea } from '../components/ui';
import { theme as t } from '../styles/GlobalStyle';
import { confirmar } from '../utils/confirmar';

const Seccion = styled(Card)`
  margin-bottom: 14px;
  h3 { font-size: 15px; margin-bottom: 10px; }
`;

const Vars = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 6px 0 12px;
  code { background: ${t.primarySoft}; color: ${t.primary}; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
`;

const VARIABLES = ['paciente', 'paciente_nombre', 'profesional', 'prestacion', 'dia', 'fecha', 'hora', 'modalidad', 'organizacion', 'direccion', 'telefono'];
const TIPOS_PLANTILLA = { confirmacion: 'Confirmación', recordatorio: 'Recordatorio', cancelacion: 'Cancelación', reprogramacion: 'Reprogramación' };
const TIPOS_CAMPO = { texto: 'Texto', numero: 'Número', fecha: 'Fecha', opcion: 'Lista de opciones', si_no: 'Sí / No' };

function Organizacion() {
  const [form, setForm] = useState(null);
  useEffect(() => {
    api.get('/config/organizacion').then((r) => setForm(r.data)).catch((err) => toast.error(errorMsg(err)));
  }, []);
  if (!form) return <Spinner />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const guardar = async () => {
    try {
      await api.put('/config/organizacion', form);
      toast.success('Datos guardados');
    } catch (err) {
      toast.error(errorMsg(err));
    }
  };
  return (
    <Seccion>
      <Grid>
        <Field label="Nombre del consultorio / centro">
          <Input value={form.nombre || ''} onChange={set('nombre')} />
        </Field>
        <Field label="Tipo">
          <Select value={form.tipo} onChange={set('tipo')}>
            <option value="consultorio">Consultorio</option>
            <option value="centro">Centro médico / clínica</option>
            <option value="profesional_independiente">Profesional independiente</option>
          </Select>
        </Field>
        <Field label="Teléfono">
          <Input value={form.telefono || ''} onChange={set('telefono')} />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email || ''} onChange={set('email')} />
        </Field>
        <Field label="Dirección" style={{ gridColumn: '1 / -1' }}>
          <Input value={form.direccion || ''} onChange={set('direccion')} />
        </Field>
        <Field label="Prefijo de país para WhatsApp">
          <Input value={form.whatsapp_codigo_pais || ''} onChange={set('whatsapp_codigo_pais')} placeholder="549" />
        </Field>
        <div style={{ alignSelf: 'end' }}>
          <Muted $size="12px">Argentina: 549 (celulares). Se antepone a los teléfonos de los pacientes al generar el link de WhatsApp.</Muted>
        </div>
        <Field label="Historia clínica">
          <Select value={Number(form.hc_compartida) ? '1' : '0'} onChange={set('hc_compartida')}>
            <option value="1">Compartida: todos los profesionales ven la historia completa</option>
            <option value="0">Privada: cada profesional ve solo lo que registró</option>
          </Select>
        </Field>
        <div style={{ alignSelf: 'end' }}>
          <Muted $size="12px">Solo los usuarios vinculados a un profesional acceden a la historia clínica. Recepción no la ve.</Muted>
        </div>
      </Grid>
      <Row $justify="flex-end" style={{ marginTop: 12 }}>
        <Button onClick={guardar}>Guardar</Button>
      </Row>
    </Seccion>
  );
}

function Estados() {
  const { estados, recargar } = useDatos();
  const [lista, setLista] = useState(() => Object.entries(estados).map(([estado, e]) => ({ estado, ...e })));
  const guardar = async () => {
    try {
      await api.put('/config/estados', lista);
      toast.success('Estados guardados');
      recargar();
    } catch (err) {
      toast.error(errorMsg(err));
    }
  };
  return (
    <Seccion>
      <Muted $size="13px">Nombre y color con que se muestra cada estado de turno en la agenda.</Muted>
      {lista.map((e, i) => (
        <Row key={e.estado} style={{ marginTop: 10 }}>
          <Input type="color" value={e.color} onChange={(ev) => setLista(lista.map((x, j) => (j === i ? { ...x, color: ev.target.value } : x)))} style={{ width: 52, height: 38, padding: 3 }} />
          <Input value={e.etiqueta} onChange={(ev) => setLista(lista.map((x, j) => (j === i ? { ...x, etiqueta: ev.target.value } : x)))} style={{ maxWidth: 260 }} />
          <Badge $color={e.color}>{e.etiqueta}</Badge>
        </Row>
      ))}
      <Row $justify="flex-end" style={{ marginTop: 12 }}>
        <Button onClick={guardar}>Guardar</Button>
      </Row>
    </Seccion>
  );
}

function Plantilla({ p, onSaved }) {
  const [form, setForm] = useState({ asunto: p.asunto || '', cuerpo: p.cuerpo, activo: !!p.activo });
  const guardar = async () => {
    try {
      await api.put(`/config/plantillas/${p.id}`, form);
      toast.success('Plantilla guardada');
      onSaved();
    } catch (err) {
      toast.error(errorMsg(err));
    }
  };
  return (
    <Seccion>
      <Row $justify="space-between">
        <h3>
          {TIPOS_PLANTILLA[p.tipo]} · <Badge $color={p.canal === 'whatsapp' ? '#16a34a' : '#1d4ed8'}>{p.canal === 'whatsapp' ? 'WhatsApp' : 'Email'}</Badge>
        </h3>
        <Check>
          <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
          Activa
        </Check>
      </Row>
      {p.canal === 'email' && (
        <Field label="Asunto">
          <Input value={form.asunto} onChange={(e) => setForm({ ...form, asunto: e.target.value })} />
        </Field>
      )}
      <Field label="Mensaje" style={{ marginTop: 8 }}>
        <Textarea rows={p.canal === 'email' ? 6 : 4} value={form.cuerpo} onChange={(e) => setForm({ ...form, cuerpo: e.target.value })} />
      </Field>
      <Row $justify="flex-end" style={{ marginTop: 8 }}>
        <Button $small onClick={guardar}>
          Guardar
        </Button>
      </Row>
    </Seccion>
  );
}

function Plantillas() {
  const [lista, setLista] = useState(null);
  const cargar = useCallback(() => {
    api.get('/config/plantillas').then((r) => setLista(r.data)).catch((err) => toast.error(errorMsg(err)));
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);
  if (!lista) return <Spinner />;
  return (
    <>
      <Muted $size="13px">Variables disponibles (se reemplazan con los datos del turno):</Muted>
      <Vars>
        {VARIABLES.map((v) => (
          <code key={v}>{`{${v}}`}</code>
        ))}
      </Vars>
      <Muted as="p" $size="13px" style={{ margin: '0 0 12px' }}>
        En los turnos virtuales el mensaje empieza con «💻 TURNO VIRTUAL» y {'{direccion}'} dice «consulta virtual».
      </Muted>
      {lista.map((p) => (
        <Plantilla key={p.id} p={p} onSaved={cargar} />
      ))}
    </>
  );
}

function CamposPaciente() {
  const [lista, setLista] = useState(null);
  const [nuevo, setNuevo] = useState({ nombre: '', tipo: 'texto', opciones: '' });
  const cargar = useCallback(() => {
    api.get('/config/campos-paciente').then((r) => setLista(r.data)).catch((err) => toast.error(errorMsg(err)));
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const agregar = async () => {
    if (!nuevo.nombre.trim()) return toast.error('Indique el nombre del campo');
    try {
      await api.post('/config/campos-paciente', { ...nuevo, orden: (lista?.length || 0) + 1 });
      setNuevo({ nombre: '', tipo: 'texto', opciones: '' });
      cargar();
    } catch (err) {
      toast.error(errorMsg(err));
    }
  };
  const quitar = async (c) => {
    const ok = await confirmar({
      tipo: 'peligro',
      titulo: `¿Quitar el campo «${c.nombre}»?`,
      mensaje: 'Deja de pedirse en la ficha del paciente. Los valores ya cargados se conservan.',
      aceptar: 'Quitar',
    });
    if (!ok) return;
    try {
      await api.delete(`/config/campos-paciente/${c.id}`);
      cargar();
    } catch (err) {
      toast.error(errorMsg(err));
    }
  };

  if (!lista) return <Spinner />;
  return (
    <Seccion>
      <Muted $size="13px">Datos adicionales que se piden en la ficha del paciente (ej: alergias, grupo sanguíneo, profesión).</Muted>
      {!lista.length && <Empty>Sin campos adicionales</Empty>}
      {lista.map((c) => (
        <Row key={c.id} style={{ marginTop: 8 }}>
          <strong style={{ minWidth: 180 }}>{c.nombre}</strong>
          <Muted>
            {TIPOS_CAMPO[c.tipo]}
            {c.tipo === 'opcion' && c.opciones ? `: ${c.opciones.split('|').join(', ')}` : ''}
          </Muted>
          <IconButton onClick={() => quitar(c)} aria-label="Quitar" style={{ marginLeft: 'auto' }}>
            <FiTrash2 />
          </IconButton>
        </Row>
      ))}
      <Grid $cols={3} style={{ marginTop: 16, alignItems: 'end' }}>
        <Field label="Nombre del campo">
          <Input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
        </Field>
        <Field label="Tipo">
          <Select value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })}>
            {Object.entries(TIPOS_CAMPO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        {nuevo.tipo === 'opcion' ? (
          <Field label="Opciones (separadas por |)">
            <Input value={nuevo.opciones} onChange={(e) => setNuevo({ ...nuevo, opciones: e.target.value })} placeholder="A+|A-|B+|0+" />
          </Field>
        ) : (
          <div />
        )}
      </Grid>
      <Row $justify="flex-end" style={{ marginTop: 10 }}>
        <Button $variant="secondary" onClick={agregar}>
          <FiPlus /> Agregar campo
        </Button>
      </Row>
    </Seccion>
  );
}

export default function Configuracion() {
  const [tab, setTab] = useState('org');
  return (
    <Page $max="900px">
      <PageHeader title="Configuración" />
      <Tabs>
        {[
          ['org', 'Organización'],
          ['estados', 'Estados y colores'],
          ['plantillas', 'Mensajes'],
          ['campos', 'Campos de paciente'],
        ].map(([k, l]) => (
          <Tab key={k} $active={tab === k} onClick={() => setTab(k)}>
            {l}
          </Tab>
        ))}
      </Tabs>
      {tab === 'org' && <Organizacion />}
      {tab === 'estados' && <Estados />}
      {tab === 'plantillas' && <Plantillas />}
      {tab === 'campos' && <CamposPaciente />}
    </Page>
  );
}
