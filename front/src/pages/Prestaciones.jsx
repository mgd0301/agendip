import { useState } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import api, { errorMsg } from '../api';
import { useAuth } from '../context/AuthContext';
import { useDatos } from '../context/DatosContext';
import { Button, Dot, Empty, Field, Grid, Input, Modal, Muted, Page, PageHeader, Table, TableWrap, Textarea } from '../components/ui';
import { confirmar } from '../utils/confirmar';

function PrestacionModal({ prest, onClose, onSaved }) {
  const [form, setForm] = useState({
    nombre: prest?.nombre || '',
    descripcion: prest?.descripcion || '',
    duracion_min: prest?.duracion_min || '',
    precio: prest?.precio ?? '',
    color: prest?.color || '#64748b',
  });
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const guardar = async (e) => {
    e?.preventDefault();
    if (!form.nombre.trim()) return toast.error('El nombre es obligatorio');
    setGuardando(true);
    try {
      if (prest) await api.put(`/prestaciones/${prest.id}`, form);
      else await api.post('/prestaciones', form);
      toast.success('Prestación guardada');
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
      titulo: '¿Dar de baja la prestación?',
      mensaje: 'No se podrá elegir en turnos nuevos. Los turnos existentes no se modifican.',
      aceptar: 'Dar de baja',
    });
    if (!ok) return;
    try {
      await api.delete(`/prestaciones/${prest.id}`);
      toast.success('Prestación dada de baja');
      onSaved();
    } catch (err) {
      toast.error(errorMsg(err));
    }
  };

  return (
    <Modal
      title={prest ? prest.nombre : 'Nueva prestación'}
      onClose={onClose}
      footer={
        <>
          {prest && (
            <Button $variant="danger" onClick={eliminar} style={{ marginRight: 'auto' }}>
              <FiTrash2 /> Dar de baja
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
      <form onSubmit={guardar}>
        <Grid>
          <Field label="Nombre *" style={{ gridColumn: '1 / -1' }}>
            <Input value={form.nombre} onChange={set('nombre')} />
          </Field>
          <Field label="Duración sugerida (min)">
            <Input type="number" min="5" step="5" value={form.duracion_min} onChange={set('duracion_min')} placeholder="Usa la del profesional" />
          </Field>
          <Field label="Precio (opcional)">
            <Input type="number" min="0" step="0.01" value={form.precio} onChange={set('precio')} />
          </Field>
          <Field label="Color">
            <Input type="color" value={form.color} onChange={set('color')} style={{ height: 38, padding: 3 }} />
          </Field>
          <Field label="Descripción" style={{ gridColumn: '1 / -1' }}>
            <Textarea rows={2} value={form.descripcion} onChange={set('descripcion')} />
          </Field>
        </Grid>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

export default function Prestaciones() {
  const { usuario } = useAuth();
  const { prestaciones, recargar } = useDatos();
  const [modal, setModal] = useState(null);
  const admin = usuario.rol === 'admin';

  return (
    <Page $max="900px">
      <PageHeader title="Prestaciones" subtitle="Tipos de atención y su duración sugerida">
        {admin && (
          <Button onClick={() => setModal({ prest: null })}>
            <FiPlus /> Nueva prestación
          </Button>
        )}
      </PageHeader>
      <TableWrap>
        {!prestaciones.length ? (
          <Empty>No hay prestaciones cargadas</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Prestación</th>
                <th>Duración sugerida</th>
                <th>Precio</th>
              </tr>
            </thead>
            <tbody>
              {prestaciones.map((p) => (
                <tr key={p.id} data-click={admin || undefined} onClick={() => admin && setModal({ prest: p })}>
                  <td>
                    <Dot $color={p.color || '#64748b'} /> <strong>{p.nombre}</strong>
                    {p.descripcion && <Muted $size="12px"> · {p.descripcion}</Muted>}
                  </td>
                  <td>{p.duracion_min ? `${p.duracion_min} min` : <Muted>la del profesional</Muted>}</td>
                  <td>{p.precio != null ? `$ ${Number(p.precio).toLocaleString('es-AR')}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </TableWrap>
      {modal && (
        <PrestacionModal
          prest={modal.prest}
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
