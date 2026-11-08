import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiPlus } from 'react-icons/fi';
import api, { errorMsg } from '../api';
import { useAuth } from '../context/AuthContext';
import { useDatos } from '../context/DatosContext';
import { Badge, Button, Check, Empty, Field, Grid, Input, Modal, Muted, Page, PageHeader, Select, Spinner, Table, TableWrap } from '../components/ui';
import { fechaHora } from '../utils/fechas';

const ROLES = {
  admin: { label: 'Administrador', color: '#1d4ed8', ayuda: 'Acceso total: configuración, usuarios, profesionales y todas las agendas.' },
  recepcion: { label: 'Recepción', color: '#059669', ayuda: 'Gestiona turnos y pacientes de todos los profesionales.' },
  profesional: { label: 'Profesional', color: '#7c3aed', ayuda: 'Ve y gestiona solo su propia agenda.' },
};

function UsuarioModal({ user, onClose, onSaved }) {
  const { usuario: yo } = useAuth();
  const { profesionales } = useDatos();
  const [form, setForm] = useState({
    nombre: user?.nombre || '',
    email: user?.email || '',
    rol: user?.rol || 'recepcion',
    profesional_id: user?.profesional_id || '',
    puede_sobreturno: !!user?.puede_sobreturno,
    activo: user ? !!user.activo : true,
    password: '',
  });
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const soyYo = user?.id === yo.id;

  const guardar = async (e) => {
    e?.preventDefault();
    setGuardando(true);
    try {
      const datos = { ...form };
      if (user && !datos.password) delete datos.password;
      if (user) await api.put(`/usuarios/${user.id}`, datos);
      else await api.post('/usuarios', datos);
      toast.success('Usuario guardado');
      onSaved();
    } catch (err) {
      toast.error(errorMsg(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      title={user ? user.nombre : 'Nuevo usuario'}
      onClose={onClose}
      footer={
        <>
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
          <Field label="Nombre *">
            <Input value={form.nombre} onChange={set('nombre')} />
          </Field>
          <Field label="Email (usuario) *">
            <Input type="email" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Rol">
            <Select value={form.rol} onChange={set('rol')} disabled={soyYo}>
              {Object.entries(ROLES).map(([k, r]) => (
                <option key={k} value={k}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={form.rol === 'profesional' ? 'Profesional vinculado *' : 'Profesional vinculado (opcional)'}>
            <Select value={form.profesional_id || ''} onChange={set('profesional_id')}>
              <option value="">Ninguno</option>
              {profesionales.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.apellido}, {p.nombre}
                </option>
              ))}
            </Select>
          </Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <Muted $size="13px">{ROLES[form.rol].ayuda}</Muted>
          </div>
          <Field label={user ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña * (mín. 6 caracteres)'}>
            <Input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
          </Field>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'end' }}>
            {form.rol !== 'admin' && (
              <Check>
                <input type="checkbox" checked={form.puede_sobreturno} onChange={set('puede_sobreturno')} />
                Puede dar sobreturnos
              </Check>
            )}
            {user && !soyYo && (
              <Check>
                <input type="checkbox" checked={form.activo} onChange={set('activo')} />
                Usuario activo
              </Check>
            )}
          </div>
        </Grid>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

export default function Usuarios() {
  const [lista, setLista] = useState(null);
  const [modal, setModal] = useState(null);

  const cargar = useCallback(() => {
    api
      .get('/usuarios')
      .then((r) => setLista(r.data))
      .catch((err) => toast.error(errorMsg(err)));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <Page $max="1000px">
      <PageHeader title="Usuarios" subtitle="Personas con acceso al sistema y sus permisos">
        <Button onClick={() => setModal({ user: null })}>
          <FiPlus /> Nuevo usuario
        </Button>
      </PageHeader>
      <TableWrap>
        {!lista ? (
          <Spinner />
        ) : !lista.length ? (
          <Empty>No hay usuarios</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Profesional</th>
                <th>Último acceso</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((u) => (
                <tr key={u.id} data-click onClick={() => setModal({ user: u })} style={{ opacity: u.activo ? 1 : 0.5 }}>
                  <td>
                    <strong>{u.nombre}</strong>
                    {!u.activo && <Muted $size="12px"> (inactivo)</Muted>}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <Badge $color={ROLES[u.rol]?.color}>{ROLES[u.rol]?.label}</Badge>
                    {u.puede_sobreturno && u.rol !== 'admin' ? <Muted $size="12px"> + sobreturnos</Muted> : null}
                  </td>
                  <td>{u.profesional_id ? `${u.prof_apellido}, ${u.prof_nombre}` : '—'}</td>
                  <td>{u.ultimo_acceso ? fechaHora(u.ultimo_acceso) : 'Nunca'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </TableWrap>
      {modal && (
        <UsuarioModal
          user={modal.user}
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
