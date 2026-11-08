import { useState } from 'react';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { FiClock, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import api, { errorMsg } from '../api';
import { useAuth } from '../context/AuthContext';
import { useDatos } from '../context/DatosContext';
import { Button, Card, Dot, Empty, Field, Grid, IconButton, Input, Modal, Muted, Page, PageHeader, Row, Tab, Tabs } from '../components/ui';
import { DIAS } from '../utils/fechas';
import { theme as t } from '../styles/GlobalStyle';
import { confirmar } from '../utils/confirmar';

const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];
const COLORES = ['#2563eb', '#059669', '#7c3aed', '#db2777', '#ea580c', '#0891b2', '#ca8a04', '#4f46e5', '#dc2626', '#475569'];

const Cards = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
`;

const ProfCard = styled(Card)`
  cursor: pointer;
  border-top: 4px solid ${(p) => p.$color};
  &:hover { box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08); }
  h3 { font-size: 16px; }
  ul { list-style: none; padding: 0; margin: 10px 0 0; font-size: 13px; }
  li { display: flex; justify-content: space-between; padding: 2px 0; }
  li span:first-child { color: ${t.muted}; }
`;

const DiaRow = styled.div`
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: 10px;
  align-items: start;
  padding: 10px 0;
  border-bottom: 1px solid ${t.border};
  > strong { padding-top: 8px; }
  @media ${t.mobile} { grid-template-columns: 1fr; }
`;

const Paleta = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  button {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2px solid #fff;
    cursor: pointer;
    box-shadow: 0 0 0 1px ${t.border};
  }
  button[aria-pressed='true'] { box-shadow: 0 0 0 2px ${t.text}; }
`;

const resumenHorario = (horarios, dia) =>
  horarios
    .filter((h) => Number(h.dia_semana) === dia)
    .map((h) => `${h.hora_desde}–${h.hora_hasta}`)
    .join(', ');

function ProfesionalModal({ prof, onClose, onSaved }) {
  const { prestaciones } = useDatos();
  const [tab, setTab] = useState('datos');
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState(() => ({
    nombre: prof?.nombre || '',
    apellido: prof?.apellido || '',
    especialidad: prof?.especialidad || '',
    matricula: prof?.matricula || '',
    email: prof?.email || '',
    telefono: prof?.telefono || '',
    color: prof?.color || COLORES[0],
    duracion_turno_min: prof?.duracion_turno_min || 30,
    horarios: (prof?.horarios || []).map((h) => ({ dia_semana: h.dia_semana, hora_desde: h.hora_desde, hora_hasta: h.hora_hasta })),
    prestaciones: prof?.prestaciones || [],
  }));
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const agregarFranja = (dia) => {
    const del = form.horarios.filter((h) => h.dia_semana === dia);
    const ultima = del[del.length - 1];
    const nueva = ultima ? { hora_desde: '16:00', hora_hasta: '20:00' } : { hora_desde: '08:00', hora_hasta: '12:00' };
    setForm({ ...form, horarios: [...form.horarios, { dia_semana: dia, ...nueva }] });
  };
  const editarFranja = (i, k, v) => setForm({ ...form, horarios: form.horarios.map((h, j) => (j === i ? { ...h, [k]: v } : h)) });
  const quitarFranja = (i) => setForm({ ...form, horarios: form.horarios.filter((_, j) => j !== i) });

  const durPrest = (id) => form.prestaciones.find((p) => p.prestacion_id === id)?.duracion_min || '';
  const setDurPrest = (id, v) =>
    setForm({
      ...form,
      prestaciones: [...form.prestaciones.filter((p) => p.prestacion_id !== id), ...(v ? [{ prestacion_id: id, duracion_min: Number(v) }] : [])],
    });

  const guardar = async () => {
    if (!form.nombre.trim() || !form.apellido.trim()) return toast.error('Nombre y apellido son obligatorios');
    setGuardando(true);
    try {
      if (prof) await api.put(`/profesionales/${prof.id}`, form);
      else await api.post('/profesionales', form);
      toast.success('Profesional guardado');
      onSaved();
    } catch (err) {
      toast.error(errorMsg(err));
    } finally {
      setGuardando(false);
    }
  };

  const desactivar = async () => {
    const ok = await confirmar({
      tipo: 'peligro',
      titulo: '¿Desactivar al profesional?',
      mensaje: 'Deja de aparecer en la agenda. Sus turnos e historial se conservan.',
      aceptar: 'Desactivar',
    });
    if (!ok) return;
    try {
      await api.delete(`/profesionales/${prof.id}`);
      toast.success('Profesional desactivado');
      onSaved();
    } catch (err) {
      toast.error(errorMsg(err));
    }
  };

  return (
    <Modal
      title={prof ? `${prof.apellido}, ${prof.nombre}` : 'Nuevo profesional'}
      onClose={onClose}
      width="720px"
      footer={
        <>
          {prof && (
            <Button $variant="danger" onClick={desactivar} style={{ marginRight: 'auto' }}>
              <FiTrash2 /> Desactivar
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
      <Tabs>
        <Tab $active={tab === 'datos'} onClick={() => setTab('datos')}>
          Datos
        </Tab>
        <Tab $active={tab === 'horarios'} onClick={() => setTab('horarios')}>
          Horario habitual
        </Tab>
        <Tab $active={tab === 'prestaciones'} onClick={() => setTab('prestaciones')}>
          Duración por prestación
        </Tab>
      </Tabs>

      {tab === 'datos' && (
        <Grid>
          <Field label="Nombre *">
            <Input value={form.nombre} onChange={set('nombre')} />
          </Field>
          <Field label="Apellido *">
            <Input value={form.apellido} onChange={set('apellido')} />
          </Field>
          <Field label="Especialidad">
            <Input value={form.especialidad} onChange={set('especialidad')} />
          </Field>
          <Field label="Matrícula">
            <Input value={form.matricula} onChange={set('matricula')} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Teléfono">
            <Input value={form.telefono} onChange={set('telefono')} />
          </Field>
          <Field label="Duración predeterminada del turno (min)">
            <Input type="number" min="5" step="5" value={form.duracion_turno_min} onChange={set('duracion_turno_min')} />
          </Field>
          <Field label="Color en la agenda">
            <Paleta>
              {COLORES.map((c) => (
                <button key={c} type="button" style={{ background: c }} aria-pressed={form.color === c} onClick={() => setForm({ ...form, color: c })} />
              ))}
            </Paleta>
          </Field>
        </Grid>
      )}

      {tab === 'horarios' && (
        <>
          <Muted $size="13px">
            Días y franjas en que atiende normalmente. Puede cargar varias franjas por día (ej: mañana y tarde). Las vacaciones, feriados y cambios
            puntuales se cargan en «Feriados y bloqueos».
          </Muted>
          {ORDEN_DIAS.map((dia) => (
            <DiaRow key={dia}>
              <strong>{DIAS[dia]}</strong>
              <div>
                {form.horarios.map((h, i) =>
                  h.dia_semana !== dia ? null : (
                    <Row key={i} style={{ marginBottom: 6 }}>
                      <Input type="time" value={h.hora_desde} onChange={(e) => editarFranja(i, 'hora_desde', e.target.value)} style={{ maxWidth: 130 }} />
                      <span>a</span>
                      <Input type="time" value={h.hora_hasta} onChange={(e) => editarFranja(i, 'hora_hasta', e.target.value)} style={{ maxWidth: 130 }} />
                      <IconButton onClick={() => quitarFranja(i)} aria-label="Quitar franja">
                        <FiX />
                      </IconButton>
                    </Row>
                  )
                )}
                {!form.horarios.some((h) => h.dia_semana === dia) && <Muted style={{ display: 'inline-block', padding: '8px 0' }}>No atiende</Muted>}
                <div>
                  <Button $small $variant="ghost" onClick={() => agregarFranja(dia)}>
                    <FiPlus /> Agregar franja
                  </Button>
                </div>
              </div>
            </DiaRow>
          ))}
        </>
      )}

      {tab === 'prestaciones' && (
        <>
          <Muted $size="13px">
            Opcional: si este profesional usa una duración distinta a la sugerida para alguna prestación, indíquela aquí.
          </Muted>
          {prestaciones.length === 0 && <Empty>No hay prestaciones cargadas.</Empty>}
          {prestaciones.map((p) => (
            <DiaRow key={p.id}>
              <strong>{p.nombre}</strong>
              <Row>
                <Input
                  type="number"
                  min="5"
                  step="5"
                  placeholder={p.duracion_min ? `${p.duracion_min} (sugerida)` : 'Sin duración'}
                  value={durPrest(p.id)}
                  onChange={(e) => setDurPrest(p.id, e.target.value)}
                  style={{ maxWidth: 180 }}
                />
                <Muted>min</Muted>
              </Row>
            </DiaRow>
          ))}
        </>
      )}
    </Modal>
  );
}

export default function Profesionales() {
  const { usuario } = useAuth();
  const { profesionales, recargar } = useDatos();
  const [modal, setModal] = useState(null);
  const admin = usuario.rol === 'admin';

  return (
    <Page>
      <PageHeader title="Profesionales" subtitle="Datos, horarios de atención y duración de turnos">
        {admin && (
          <Button onClick={() => setModal({ prof: null })}>
            <FiPlus /> Nuevo profesional
          </Button>
        )}
      </PageHeader>
      {profesionales.length === 0 && <Empty>Todavía no hay profesionales cargados.</Empty>}
      <Cards>
        {profesionales.map((p) => (
          <ProfCard key={p.id} $color={p.color} onClick={() => admin && setModal({ prof: p })} style={{ cursor: admin ? 'pointer' : 'default' }}>
            <Row>
              <Dot $color={p.color} />
              <h3>
                {p.apellido}, {p.nombre}
              </h3>
            </Row>
            <Muted $size="13px">
              {[p.especialidad, p.matricula].filter(Boolean).join(' · ') || 'Sin especialidad'} · <FiClock style={{ verticalAlign: -2 }} /> {p.duracion_turno_min} min
            </Muted>
            <ul>
              {ORDEN_DIAS.map((d) => {
                const r = resumenHorario(p.horarios, d);
                return r ? (
                  <li key={d}>
                    <span>{DIAS[d]}</span>
                    <span>{r}</span>
                  </li>
                ) : null;
              })}
              {!p.horarios.length && <li>Sin horario cargado</li>}
            </ul>
          </ProfCard>
        ))}
      </Cards>
      {modal && (
        <ProfesionalModal
          prof={modal.prof}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            recargar();
          }}
        />
      )}
    </Page>
  );
}
