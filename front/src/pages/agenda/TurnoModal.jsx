import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { FaWhatsapp } from 'react-icons/fa';
import { FiCheck, FiClock, FiUserX, FiXCircle, FiRotateCcw } from 'react-icons/fi';
import api, { errorMsg } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useDatos } from '../../context/DatosContext';
import PacienteSelector from '../../components/PacienteSelector';
import { Badge, Button, Field, Grid, Input, Modal, Muted, Row, Select, Spinner, Tab, Tabs, Textarea } from '../../components/ui';
import { ahora, fechaHora, fechaLarga } from '../../utils/fechas';
import { confirmar } from '../../utils/confirmar';
import { theme as t } from '../../styles/GlobalStyle';

const Slots = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 168px;
  overflow-y: auto;
  padding: 2px;
  button {
    border: 1.5px solid #cbd5e1;
    background: #fff;
    color: #0f172a;
    border-radius: 8px;
    padding: 7px 13px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    font-variant-numeric: tabular-nums;
  }
  button:hover { border-color: ${t.primary}; color: ${t.primary}; }
  button[aria-pressed='true'] { background: ${t.primary}; border-color: ${t.primary}; color: #fff; }
`;

const Historial = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  li { padding: 10px 0; border-bottom: 1px solid ${t.border}; }
  li:last-child { border-bottom: none; }
  strong { text-transform: capitalize; }
`;

const Aviso = styled.div`
  padding: 10px 12px;
  border-radius: 8px;
  background: ${(p) => p.$bg || '#fef3c7'};
  color: ${(p) => p.$color || '#92400e'};
  font-size: 13px;
  margin-bottom: 12px;
`;

const ACCIONES = [
  { estado: 'confirmado', label: 'Confirmar', icon: FiCheck },
  { estado: 'atendido', label: 'Atendido', icon: FiCheck },
  { estado: 'ausente', label: 'Ausente', icon: FiUserX },
];

const TIPOS_MSJ = [
  ['confirmacion', 'Confirmación'],
  ['recordatorio', 'Recordatorio'],
  ['reprogramacion', 'Reprogramación'],
  ['cancelacion', 'Cancelación'],
];

/**
 * Alta o edición de un turno.
 * - inicial: { fecha, hora, profesional_id } para un turno nuevo
 * - turnoId: id de un turno existente
 */
export default function TurnoModal({ turnoId, inicial, onClose, onSaved }) {
  const { usuario } = useAuth();
  const { profesionales, prestaciones, estados } = useDatos();
  const [turno, setTurno] = useState(null);
  const [cargando, setCargando] = useState(!!turnoId);
  const [tab, setTab] = useState('datos');
  const [guardando, setGuardando] = useState(false);
  const [cancelando, setCancelando] = useState(null);
  const [libres, setLibres] = useState(null);
  const [form, setForm] = useState(() => {
    const profId = inicial?.profesional_id || (usuario.rol === 'profesional' ? usuario.profesional_id : profesionales[0]?.id) || '';
    const p = profesionales.find((x) => Number(x.id) === Number(profId));
    return {
    profesional_id: profId,
    paciente: null,
    prestacion_id: '',
    fecha: inicial?.fecha || '',
    hora: inicial?.hora || '',
    duracion_min: turnoId ? '' : p?.duracion_turno_min || '',
    observaciones: '',
  };
  });

  const prof = profesionales.find((p) => Number(p.id) === Number(form.profesional_id));
  const cancelado = turno?.estado === 'cancelado';
  // Turno nuevo (o reprogramado) para un momento que ya pasó: se permite, pero avisando.
  const fechaHoraForm = `${form.fecha} ${form.hora}`;
  const enPasado =
    !!form.fecha && !!form.hora && fechaHoraForm < ahora() && (!turno || turno.inicio.slice(0, 16) !== fechaHoraForm);

  const cargar = () =>
    api.get(`/turnos/${turnoId}`).then(({ data }) => {
      setTurno(data);
      setForm({
        profesional_id: data.profesional_id,
        paciente: { id: data.paciente_id, nombre: data.pac_nombre, apellido: data.pac_apellido, dni: data.pac_dni, telefono: data.pac_telefono },
        prestacion_id: data.prestacion_id || '',
        fecha: data.inicio.slice(0, 10),
        hora: data.inicio.slice(11, 16),
        duracion_min: data.duracion_min,
        observaciones: data.observaciones || '',
      });
    });

  useEffect(() => {
    if (!turnoId) return;
    cargar()
      .catch((err) => {
        toast.error(errorMsg(err));
        onClose();
      })
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnoId]);

  // Horarios libres del día para la duración elegida
  useEffect(() => {
    if (!form.profesional_id || !form.fecha || cancelado) return;
    const ctrl = new AbortController();
    api
      .get('/turnos/disponibilidad', {
        params: { profesional_id: form.profesional_id, fecha: form.fecha, duracion: form.duracion_min || undefined, excluir: turnoId },
        signal: ctrl.signal,
      })
      .then((r) => setLibres(r.data))
      .catch(() => {});
    return () => ctrl.abort();
  }, [form.profesional_id, form.fecha, form.duracion_min, turnoId, cancelado]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // Al cambiar de profesional en un turno nuevo, se toma su duración predeterminada.
  const cambiarProfesional = (e) => {
    const nuevo = profesionales.find((p) => String(p.id) === e.target.value);
    setLibres(null);
    setForm({ ...form, profesional_id: e.target.value, duracion_min: !turnoId && !form.prestacion_id ? nuevo?.duracion_turno_min || form.duracion_min : form.duracion_min });
  };

  const cambiarPrestacion = (e) => {
    const id = e.target.value;
    const ps = prestaciones.find((p) => String(p.id) === id);
    const especifica = prof?.prestaciones?.find((p) => String(p.prestacion_id) === id)?.duracion_min;
    setForm({ ...form, prestacion_id: id, duracion_min: especifica || ps?.duracion_min || prof?.duracion_turno_min || form.duracion_min });
  };

  const bloquesDur = useMemo(() => {
    const b = Number(prof?.duracion_turno_min) || 30;
    return [1, 2, 3, 4].map((n) => n * b);
  }, [prof]);

  const guardar = async (sobreturno = false) => {
    if (!form.paciente) return toast.error('Seleccione o cree un paciente');
    if (!form.profesional_id || !form.fecha || !form.hora) return toast.error('Complete profesional, fecha y hora');
    if (
      !sobreturno &&
      enPasado &&
      !(await confirmar({
        tipo: 'aviso',
        titulo: 'La fecha ya pasó',
        mensaje: `El turno es para el ${fechaLarga(form.fecha)} a las ${form.hora}, antes del momento actual.

¿Cargarlo igual? Sirve para registrar atenciones que no se anotaron a tiempo.`,
        aceptar: 'Cargar igual',
      }))
    )
      return;
    setGuardando(true);
    const body = {
      profesional_id: form.profesional_id,
      paciente_id: form.paciente.id,
      prestacion_id: form.prestacion_id || null,
      fecha: form.fecha,
      hora: form.hora,
      duracion_min: Number(form.duracion_min) || undefined,
      observaciones: form.observaciones,
      sobreturno,
    };
    try {
      const { data } = turnoId ? await api.put(`/turnos/${turnoId}`, body) : await api.post('/turnos', body);
      toast.success(turnoId ? 'Turno actualizado' : 'Turno asignado');
      onSaved(data);
    } catch (err) {
      const code = err.response?.data?.code;
      if (
        code === 'REQUIERE_SOBRETURNO' &&
        (await confirmar({
          tipo: 'aviso',
          titulo: '¿Asignar como sobreturno?',
          mensaje: `${errorMsg(err)}.\n\nPuede asignarlo igualmente: quedará marcado como sobreturno.`,
          aceptar: 'Asignar sobreturno',
        }))
      ) {
        setGuardando(false);
        return guardar(true);
      }
      toast.error(errorMsg(err));
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (estado, extra = {}) => {
    try {
      const { data } = await api.patch(`/turnos/${turnoId}/estado`, { estado, ...extra });
      toast.success(`Turno ${estados[estado]?.etiqueta.toLowerCase() || estado}`);
      setCancelando(null);
      await cargar();
      onSaved(data, { cerrar: false });
    } catch (err) {
      if (
        err.response?.data?.code === 'REQUIERE_SOBRETURNO' &&
        (await confirmar({
          tipo: 'aviso',
          titulo: '¿Reactivar como sobreturno?',
          mensaje: `${errorMsg(err)}.\n\nPuede reactivarlo igualmente: quedará marcado como sobreturno.`,
          aceptar: 'Reactivar',
        }))
      ) {
        return cambiarEstado(estado, { ...extra, sobreturno: true });
      }
      toast.error(errorMsg(err));
    }
  };

  const whatsapp = async (tipo) => {
    // Se abre la ventana antes del await para que el navegador no la bloquee.
    const ventana = window.open('', '_blank');
    try {
      const { data } = await api.post(`/turnos/${turnoId}/whatsapp`, { tipo });
      if (ventana) ventana.location.href = data.link;
      else window.location.assign(data.link);
      cargar();
    } catch (err) {
      ventana?.close();
      toast.error(errorMsg(err));
    }
  };

  const titulo = turnoId ? 'Turno' : 'Nuevo turno';
  const est = turno && estados[turno.estado];

  const footer = cargando ? null : (
    <>
      {turnoId && !cancelado && (
        <Button $variant="danger" onClick={() => setCancelando('')} style={{ marginRight: 'auto' }}>
          <FiXCircle /> Cancelar turno
        </Button>
      )}
      {cancelado && (
        <Button $variant="secondary" onClick={() => cambiarEstado('pendiente')} style={{ marginRight: 'auto' }}>
          <FiRotateCcw /> Reactivar
        </Button>
      )}
      <Button $variant="secondary" onClick={onClose}>
        Cerrar
      </Button>
      {!cancelado && (
        <Button onClick={() => guardar(false)} disabled={guardando}>
          {guardando ? 'Guardando…' : turnoId ? 'Guardar cambios' : 'Asignar turno'}
        </Button>
      )}
    </>
  );

  return (
    <Modal title={titulo} onClose={onClose} footer={footer} width="620px">
      {cargando ? (
        <Spinner />
      ) : (
        <>
          {turno && (
            <>
              <Row $wrap $justify="space-between" style={{ marginBottom: 12 }}>
                <Row $wrap>
                  <Badge $color={est?.color}>{est?.etiqueta}</Badge>
                  {!!turno.sobreturno && <Badge $color="#9333ea">Sobreturno</Badge>}
                </Row>
                {!cancelado && (
                  <Row $wrap>
                    {ACCIONES.filter((a) => a.estado !== turno.estado).map(({ estado, label, icon: Icon }) => (
                      <Button key={estado} $small $variant="secondary" onClick={() => cambiarEstado(estado)}>
                        <Icon color={estados[estado]?.color} /> {label}
                      </Button>
                    ))}
                    {turno.estado !== 'pendiente' && (
                      <Button $small $variant="ghost" onClick={() => cambiarEstado('pendiente')}>
                        <FiClock /> Pendiente
                      </Button>
                    )}
                  </Row>
                )}
              </Row>
              {cancelado && (
                <Aviso $bg="#f1f5f9" $color="#475569">
                  Turno cancelado{turno.motivo_cancelacion ? `: ${turno.motivo_cancelacion}` : ''}.
                </Aviso>
              )}
              {cancelando !== null && (
                <Aviso $bg="#fef2f2" $color="#991b1b">
                  <Field label="Motivo de la cancelación (opcional)">
                    <Input autoFocus value={cancelando} onChange={(e) => setCancelando(e.target.value)} />
                  </Field>
                  <Row $justify="flex-end" style={{ marginTop: 8 }}>
                    <Button $small $variant="ghost" onClick={() => setCancelando(null)}>
                      Volver
                    </Button>
                    <Button $small $variant="danger" onClick={() => cambiarEstado('cancelado', { motivo: cancelando })}>
                      Confirmar cancelación
                    </Button>
                  </Row>
                </Aviso>
              )}
              <Tabs>
                <Tab $active={tab === 'datos'} onClick={() => setTab('datos')}>
                  Datos
                </Tab>
                <Tab $active={tab === 'mensajes'} onClick={() => setTab('mensajes')}>
                  Mensajes
                </Tab>
                <Tab $active={tab === 'historial'} onClick={() => setTab('historial')}>
                  Historial ({turno.historial.length})
                </Tab>
              </Tabs>
            </>
          )}

          {tab === 'datos' && (
            <Grid>
              <Field label="Paciente *" style={{ gridColumn: '1 / -1' }}>
                <PacienteSelector value={form.paciente} onChange={(p) => setForm({ ...form, paciente: p })} disabled={cancelado} />
              </Field>
              <Field label="Profesional *">
                <Select value={form.profesional_id} onChange={cambiarProfesional} disabled={cancelado || usuario.rol === 'profesional'}>
                  <option value="">Seleccionar…</option>
                  {profesionales.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.apellido}, {p.nombre}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Prestación">
                <Select value={form.prestacion_id} onChange={cambiarPrestacion} disabled={cancelado}>
                  <option value="">Sin especificar</option>
                  {prestaciones.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                      {p.duracion_min ? ` (${p.duracion_min} min)` : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Fecha *">
                <Input type="date" value={form.fecha} onChange={set('fecha')} disabled={cancelado} />
              </Field>
              <Row $gap="8px" style={{ alignItems: 'flex-end' }}>
                <Field label="Hora *" style={{ flex: 1 }}>
                  <Input type="time" step="300" value={form.hora} onChange={set('hora')} disabled={cancelado} />
                </Field>
                <Field label="Duración (min)" style={{ flex: 1 }}>
                  <Input type="number" min="5" step="5" value={form.duracion_min} onChange={set('duracion_min')} disabled={cancelado} list="duraciones" />
                  <datalist id="duraciones">
                    {bloquesDur.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </Field>
              </Row>

              {!cancelado && enPasado && (
                <Aviso style={{ gridColumn: '1 / -1', marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FiClock /> La fecha y hora elegidas ya pasaron. Se puede cargar igual, pero revisá que sea correcto.
                </Aviso>
              )}

              {!cancelado && libres && form.profesional_id && form.fecha && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <Muted $size="13px">
                    {form.fecha && fechaLarga(form.fecha)} ·{' '}
                    {libres.franjas.length ? `Atiende ${libres.franjas.map((f) => `${f.desde}–${f.hasta}`).join(', ')}` : 'No atiende este día'}
                    {libres.bloqueos.map((b) => ` · ${b.motivo || b.tipo.replace('_', ' ')}`).join('')}
                  </Muted>
                  {libres.libres.length > 0 ? (
                    <Slots style={{ marginTop: 8 }}>
                      {libres.libres.map((h) => (
                        <button key={h} type="button" aria-pressed={h === form.hora} onClick={() => setForm({ ...form, hora: h })}>
                          {h}
                        </button>
                      ))}
                    </Slots>
                  ) : (
                    libres.franjas.length > 0 && (
                      <Muted $size="13px" style={{ display: 'block', marginTop: 6 }}>
                        Sin horarios libres para {form.duracion_min} min.
                      </Muted>
                    )
                  )}
                </div>
              )}

              <Field label="Observaciones" style={{ gridColumn: '1 / -1' }}>
                <Textarea value={form.observaciones} onChange={set('observaciones')} disabled={cancelado} rows={2} />
              </Field>
              {turno && (
                <Muted $size="12px" style={{ gridColumn: '1 / -1' }}>
                  Creado {fechaHora(turno.creado_en)}
                  {turno.creado_por_nombre && ` por ${turno.creado_por_nombre}`}
                  {turno.actualizado_en && ` · Modificado ${fechaHora(turno.actualizado_en)}${turno.actualizado_por_nombre ? ` por ${turno.actualizado_por_nombre}` : ''}`}
                </Muted>
              )}
            </Grid>
          )}

          {tab === 'mensajes' && turno && (
            <div>
              <p style={{ marginTop: 0 }}>
                Enviar los datos del turno a <strong>{turno.pac_nombre}</strong> por WhatsApp
                {turno.pac_telefono ? ` (${turno.pac_telefono})` : ''}. Se abre WhatsApp con el mensaje preparado según la plantilla.
              </p>
              {!turno.pac_telefono && <Aviso>El paciente no tiene teléfono cargado.</Aviso>}
              <Row $wrap>
                {TIPOS_MSJ.map(([tipo, label]) => (
                  <Button key={tipo} $variant="whatsapp" disabled={!turno.pac_telefono} onClick={() => whatsapp(tipo)}>
                    <FaWhatsapp /> {label}
                  </Button>
                ))}
              </Row>
            </div>
          )}

          {tab === 'historial' && turno && (
            <Historial>
              {turno.historial.map((h) => (
                <li key={h.id}>
                  <Row $justify="space-between" $wrap>
                    <strong>{h.accion}</strong>
                    <Muted $size="12px">
                      {fechaHora(h.fecha)} · {h.usuario || 'Sistema'}
                    </Muted>
                  </Row>
                  {h.detalle && <div style={{ marginTop: 2 }}>{h.detalle}</div>}
                </li>
              ))}
            </Historial>
          )}

          {!turnoId && usuario.puede_sobreturno && (
            <Muted $size="12px" style={{ display: 'block', marginTop: 12 }}>
              Si el horario está ocupado o fuera de la atención, se le ofrecerá asignarlo como sobreturno.
            </Muted>
          )}
        </>
      )}
    </Modal>
  );
}
