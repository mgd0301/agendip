import { useState } from 'react';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import api, { errorMsg } from '../api';
import { useAuth } from '../context/AuthContext';
import { useDatos } from '../context/DatosContext';
import { Button, Empty, Field, Input, Modal, Muted, Page, PageHeader, Row, Table, TableWrap } from '../components/ui';
import { theme as t } from '../styles/GlobalStyle';
import { confirmar } from '../utils/confirmar';

const Planes = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 4px 0 12px;
`;

const Plan = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: ${t.primarySoft};
  color: ${t.primary};
  border-radius: 999px;
  padding: 4px 6px 4px 12px;
  font-size: 13px;
  font-weight: 600;
  button {
    display: inline-flex;
    border: 0;
    background: none;
    color: inherit;
    cursor: pointer;
    padding: 2px;
    border-radius: 50%;
    &:hover { background: #fff; }
  }
`;

// Alta y edición de una obra social con sus planes.
// En una obra social nueva los planes se guardan junto con ella; en una existente, al agregarlos.
function ObraSocialModal({ os, onClose, onSaved }) {
  const [nombre, setNombre] = useState(os?.nombre || '');
  const [planes, setPlanes] = useState(os?.planes || []);
  const [nuevoPlan, setNuevoPlan] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [cambios, setCambios] = useState(false);

  const agregarPlan = async () => {
    const n = nuevoPlan.trim();
    if (!n) return;
    if (planes.some((p) => p.nombre.toLowerCase() === n.toLowerCase())) return toast.error('Ese plan ya está en la lista');
    try {
      if (os) {
        const r = await api.post(`/obras-sociales/${os.id}/planes`, { nombre: n });
        setPlanes([...planes, { id: r.data.id, nombre: n }]);
        setCambios(true);
      } else {
        setPlanes([...planes, { nombre: n }]);
      }
      setNuevoPlan('');
    } catch (err) {
      toast.error(errorMsg(err));
    }
  };

  const quitarPlan = async (plan) => {
    if (plan.id) {
      const ok = await confirmar({
        tipo: 'peligro',
        titulo: `¿Quitar el plan «${plan.nombre}»?`,
        mensaje: 'No se podrá elegir en pacientes nuevos. Los pacientes que ya lo tienen lo conservan.',
        aceptar: 'Quitar',
      });
      if (!ok) return;
      try {
        await api.delete(`/obras-sociales/planes/${plan.id}`);
        setCambios(true);
      } catch (err) {
        return toast.error(errorMsg(err));
      }
    }
    setPlanes(planes.filter((p) => p !== plan));
  };

  const guardar = async (e) => {
    e?.preventDefault();
    if (!nombre.trim()) return toast.error('El nombre es obligatorio');
    setGuardando(true);
    try {
      if (os) {
        await api.put(`/obras-sociales/${os.id}`, { nombre });
      } else {
        const r = await api.post('/obras-sociales', { nombre });
        for (const p of planes) await api.post(`/obras-sociales/${r.data.id}/planes`, { nombre: p.nombre });
      }
      toast.success('Obra social guardada');
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
      titulo: `¿Dar de baja «${os.nombre}»?`,
      mensaje: 'No se podrá elegir en pacientes nuevos. Los pacientes que ya la tienen la conservan.',
      aceptar: 'Dar de baja',
    });
    if (!ok) return;
    try {
      await api.delete(`/obras-sociales/${os.id}`);
      toast.success('Obra social dada de baja');
      onSaved();
    } catch (err) {
      toast.error(errorMsg(err));
    }
  };

  // Si se agregaron o quitaron planes, la lista de atrás se refresca aunque se cierre sin guardar.
  const cerrar = cambios ? onSaved : onClose;

  return (
    <Modal
      title={os ? os.nombre : 'Nueva obra social'}
      onClose={cerrar}
      footer={
        <>
          {os && (
            <Button $variant="danger" onClick={eliminar} style={{ marginRight: 'auto' }}>
              <FiTrash2 /> Dar de baja
            </Button>
          )}
          <Button $variant="secondary" onClick={cerrar}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            Guardar
          </Button>
        </>
      }
    >
      <form onSubmit={guardar}>
        <Field label="Nombre *">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: OSDE, PAMI, Swiss Medical" />
        </Field>
        <button type="submit" hidden />
      </form>

      <Field label="Planes" style={{ marginTop: 14 }}>
        <Planes>
          {planes.length ? (
            planes.map((p) => (
              <Plan key={p.id || p.nombre}>
                {p.nombre}
                <button type="button" onClick={() => quitarPlan(p)} aria-label={`Quitar ${p.nombre}`}>
                  <FiX />
                </button>
              </Plan>
            ))
          ) : (
            <Muted $size="13px">Sin planes. Si la obra social no tiene planes, se puede dejar así.</Muted>
          )}
        </Planes>
      </Field>
      <Row>
        <Input
          value={nuevoPlan}
          onChange={(e) => setNuevoPlan(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              agregarPlan();
            }
          }}
          placeholder="Nuevo plan (ej: 210, Bronce, Integral)"
        />
        <Button $variant="secondary" onClick={agregarPlan} style={{ flexShrink: 0 }}>
          <FiPlus /> Agregar plan
        </Button>
      </Row>
    </Modal>
  );
}

export default function ObrasSociales() {
  const { usuario } = useAuth();
  const { obrasSociales, recargar } = useDatos();
  const [modal, setModal] = useState(null);
  const editor = usuario.rol !== 'profesional';

  return (
    <Page $max="900px">
      <PageHeader title="Obras sociales" subtitle="Obras sociales y prepagas, con sus planes">
        {editor && (
          <Button onClick={() => setModal({ os: null })}>
            <FiPlus /> Nueva obra social
          </Button>
        )}
      </PageHeader>
      <TableWrap>
        {!obrasSociales.length ? (
          <Empty>No hay obras sociales cargadas</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Obra social</th>
                <th>Planes</th>
              </tr>
            </thead>
            <tbody>
              {obrasSociales.map((os) => (
                <tr key={os.id} data-click={editor || undefined} onClick={() => editor && setModal({ os })}>
                  <td>
                    <strong>{os.nombre}</strong>
                  </td>
                  <td>{os.planes.length ? os.planes.map((p) => p.nombre).join(', ') : <Muted>—</Muted>}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </TableWrap>
      {modal && (
        <ObraSocialModal
          os={modal.os}
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
