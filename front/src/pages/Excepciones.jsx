import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import api, { errorMsg } from '../api';
import { useAuth } from '../context/AuthContext';
import { useDatos } from '../context/DatosContext';
import { Badge, Button, Check, Empty, Field, Grid, Input, Modal, Muted, Page, PageHeader, Row, Select, Spinner, Table, TableWrap } from '../components/ui';
import { fechaCorta, hoy } from '../utils/fechas';
import { confirmar } from '../utils/confirmar';

const TIPOS = {
  feriado: { label: 'Feriado', color: '#dc2626' },
  vacaciones: { label: 'Vacaciones', color: '#7c3aed' },
  licencia: { label: 'Licencia', color: '#db2777' },
  dia_libre: { label: 'Día libre', color: '#0891b2' },
  bloqueo: { label: 'Bloqueo de horario', color: '#ea580c' },
  horario_especial: { label: 'Horario especial', color: '#059669' },
};

const AYUDA = {
  feriado: 'Bloquea el día completo. Si no elige profesional, aplica a toda la organización.',
  vacaciones: 'El profesional no atiende en el rango de fechas indicado.',
  licencia: 'El profesional no atiende en el rango de fechas indicado.',
  dia_libre: 'Bloquea uno o varios días puntuales.',
  bloqueo: 'Bloquea un rango horario (ej: reunión de 10 a 12). Sin horas, bloquea el día entero.',
  horario_especial: 'Reemplaza el horario habitual del profesional en esas fechas (ej: un sábado que atiende de 9 a 13).',
};

function ExcepcionModal({ exc, onClose, onSaved }) {
  const { usuario } = useAuth();
  const { profesionales } = useDatos();
  const esProf = usuario.rol === 'profesional';
  const [form, setForm] = useState({
    tipo: exc?.tipo || 'feriado',
    profesional_id: exc?.profesional_id || (esProf ? usuario.profesional_id : ''),
    fecha_desde: exc?.fecha_desde || hoy(),
    fecha_hasta: exc?.fecha_hasta || hoy(),
    hora_desde: exc?.hora_desde || '',
    hora_hasta: exc?.hora_hasta || '',
    motivo: exc?.motivo || '',
  });
  const [conHoras, setConHoras] = useState(!!exc?.hora_desde);
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => {
    const v = e.target.value;
    const nuevo = { ...form, [k]: v };
    if (k === 'fecha_desde' && form.fecha_hasta < v) nuevo.fecha_hasta = v;
    setForm(nuevo);
  };
  const horasObligatorias = form.tipo === 'horario_especial';
  const usaHoras = horasObligatorias || conHoras;

  const guardar = async () => {
    const datos = { ...form, hora_desde: usaHoras ? form.hora_desde : null, hora_hasta: usaHoras ? form.hora_hasta : null };
    setGuardando(true);
    try {
      if (exc) await api.put(`/excepciones/${exc.id}`, datos);
      else await api.post('/excepciones', datos);
      toast.success('Guardado');
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
      titulo: '¿Eliminar esta excepción?',
      mensaje: 'La agenda vuelve a su horario habitual en esas fechas.',
      aceptar: 'Eliminar',
    });
    if (!ok) return;
    try {
      await api.delete(`/excepciones/${exc.id}`);
      toast.success('Eliminada');
      onSaved();
    } catch (err) {
      toast.error(errorMsg(err));
    }
  };

  return (
    <Modal
      title={exc ? 'Editar excepción' : 'Nueva excepción'}
      onClose={onClose}
      footer={
        <>
          {exc && (
            <Button $variant="danger" onClick={eliminar} style={{ marginRight: 'auto' }}>
              <FiTrash2 /> Eliminar
            </Button>
          )}
          <Button $variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            Guardar
          </Button>
        </>
      }
    >
      <Grid>
        <Field label="Tipo">
          <Select value={form.tipo} onChange={set('tipo')}>
            {Object.entries(TIPOS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Profesional">
          <Select value={form.profesional_id || ''} onChange={set('profesional_id')} disabled={esProf}>
            {!horasObligatorias && <option value="">Toda la organización</option>}
            {horasObligatorias && !form.profesional_id && <option value="">Elegir…</option>}
            {profesionales.map((p) => (
              <option key={p.id} value={p.id}>
                {p.apellido}, {p.nombre}
              </option>
            ))}
          </Select>
        </Field>
        <div style={{ gridColumn: '1 / -1' }}>
          <Muted $size="13px">{AYUDA[form.tipo]}</Muted>
        </div>
        <Field label="Desde">
          <Input type="date" value={form.fecha_desde} onChange={set('fecha_desde')} />
        </Field>
        <Field label="Hasta">
          <Input type="date" value={form.fecha_hasta} min={form.fecha_desde} onChange={set('fecha_hasta')} />
        </Field>
        {!horasObligatorias && (
          <div style={{ gridColumn: '1 / -1' }}>
            <Check>
              <input type="checkbox" checked={conHoras} onChange={(e) => setConHoras(e.target.checked)} />
              Solo una parte del día (indicar horario)
            </Check>
          </div>
        )}
        {usaHoras && (
          <>
            <Field label={horasObligatorias ? 'Atiende desde' : 'Bloquear desde'}>
              <Input type="time" value={form.hora_desde} onChange={set('hora_desde')} />
            </Field>
            <Field label={horasObligatorias ? 'Atiende hasta' : 'Bloquear hasta'}>
              <Input type="time" value={form.hora_hasta} onChange={set('hora_hasta')} />
            </Field>
          </>
        )}
        <Field label="Motivo / descripción" style={{ gridColumn: '1 / -1' }}>
          <Input value={form.motivo} onChange={set('motivo')} placeholder="Ej: Día del Trabajador, congreso, etc." />
        </Field>
      </Grid>
    </Modal>
  );
}

export default function Excepciones() {
  const { usuario } = useAuth();
  const { profesionales } = useDatos();
  const [filtro, setFiltro] = useState({ profesional_id: '', pasadas: false });
  const [lista, setLista] = useState(null);
  const [modal, setModal] = useState(null);

  const cargar = useCallback(() => {
    const params = { profesional_id: filtro.profesional_id || undefined, desde: filtro.pasadas ? undefined : hoy() };
    api
      .get('/excepciones', { params })
      .then((r) => setLista(r.data))
      .catch((err) => toast.error(errorMsg(err)));
  }, [filtro]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <Page $max="1000px">
      <PageHeader title="Feriados y bloqueos" subtitle="Excepciones que modifican el horario habitual de la agenda">
        <Button onClick={() => setModal({ exc: null })}>
          <FiPlus /> Nueva excepción
        </Button>
      </PageHeader>
      <Row style={{ marginBottom: 12 }} $wrap>
        {usuario.rol !== 'profesional' && (
          <Select value={filtro.profesional_id} onChange={(e) => setFiltro({ ...filtro, profesional_id: e.target.value })} style={{ maxWidth: 260 }}>
            <option value="">Todos los profesionales</option>
            {profesionales.map((p) => (
              <option key={p.id} value={p.id}>
                {p.apellido}, {p.nombre}
              </option>
            ))}
          </Select>
        )}
        <Check>
          <input type="checkbox" checked={filtro.pasadas} onChange={(e) => setFiltro({ ...filtro, pasadas: e.target.checked })} />
          Mostrar también las pasadas
        </Check>
      </Row>
      <TableWrap>
        {!lista ? (
          <Spinner />
        ) : !lista.length ? (
          <Empty>No hay excepciones {filtro.pasadas ? '' : 'próximas'}</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Fechas</th>
                <th>Horario</th>
                <th>Aplica a</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((e) => (
                <tr key={e.id} data-click onClick={() => setModal({ exc: e })}>
                  <td>
                    <Badge $color={TIPOS[e.tipo]?.color}>{TIPOS[e.tipo]?.label || e.tipo}</Badge>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {e.fecha_desde === e.fecha_hasta ? fechaCorta(e.fecha_desde) : `${fechaCorta(e.fecha_desde)} al ${fechaCorta(e.fecha_hasta)}`}
                  </td>
                  <td>{e.hora_desde ? `${e.hora_desde} – ${e.hora_hasta}` : 'Todo el día'}</td>
                  <td>{e.profesional_id ? `${e.prof_apellido}, ${e.prof_nombre}` : <strong>Toda la organización</strong>}</td>
                  <td>{e.motivo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </TableWrap>
      {modal && (
        <ExcepcionModal
          exc={modal.exc}
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
