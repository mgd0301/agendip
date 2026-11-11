import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiLogIn, FiPlus } from 'react-icons/fi';
import api, { errorMsg } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  Badge, Button, Check, Empty, Field, Grid, Input, Modal, Muted, Page, PageHeader, Select, Spinner, Table, TableWrap,
} from '../components/ui';
import { fechaCorta, fechaHora } from '../utils/fechas';
import { confirmar } from '../utils/confirmar';

const TIPOS = { consultorio: 'Consultorio', centro: 'Centro de atención', profesional_independiente: 'Profesional independiente' };
const ROL = { admin: 'Administrador', recepcion: 'Recepción', profesional: 'Profesional' };

function Usuarios({ orgId }) {
  const [lista, setLista] = useState(null);
  useEffect(() => {
    api
      .get(`/superadmin/organizaciones/${orgId}/usuarios`)
      .then((r) => setLista(r.data))
      .catch((err) => toast.error(errorMsg(err)));
  }, [orgId]);

  if (!lista) return <Spinner />;
  if (!lista.length) return <Muted $size="13px">Sin usuarios</Muted>;
  return (
    <Table>
      <tbody>
        {lista.map((u) => (
          <tr key={u.id} style={{ opacity: u.activo ? 1 : 0.5 }}>
            <td>
              <strong>{u.nombre}</strong>
              <br />
              <Muted $size="12px">{u.email}</Muted>
            </td>
            <td>{ROL[u.rol]}</td>
            <td>
              <Muted $size="12px">{u.ultimo_acceso ? fechaHora(u.ultimo_acceso) : 'Nunca entró'}</Muted>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function OrganizacionModal({ org, onClose, onSaved }) {
  const [form, setForm] = useState({
    nombre: org?.nombre || '',
    tipo: org?.tipo || 'consultorio',
    email: org?.email || '',
    telefono: org?.telefono || '',
    plan: org?.plan || 'basico',
    max_profesionales: org?.max_profesionales || '',
    activo: org ? !!org.activo : true,
    admin: { nombre: '', email: '', password: '' },
  });
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const setAdmin = (k) => (e) => setForm({ ...form, admin: { ...form.admin, [k]: e.target.value } });

  const guardar = async (e) => {
    e?.preventDefault();
    if (
      org?.activo &&
      !form.activo &&
      !(await confirmar({
        tipo: 'peligro',
        titulo: '¿Dar de baja la organización?',
        mensaje: `Nadie de "${org.nombre}" va a poder ingresar hasta que se reactive.\nNo se borra ningún dato.`,
        aceptar: 'Dar de baja',
      }))
    )
      return;
    setGuardando(true);
    try {
      if (org) {
        const { admin, ...datos } = form; // eslint-disable-line no-unused-vars
        await api.put(`/superadmin/organizaciones/${org.id}`, datos);
        toast.success('Organización guardada');
      } else {
        const { data } = await api.post('/superadmin/organizaciones', form);
        toast.success(
          data.admin.existente
            ? 'Organización creada. El administrador ya tenía cuenta: entra con su contraseña de siempre.'
            : 'Organización creada'
        );
      }
      onSaved();
    } catch (err) {
      toast.error(errorMsg(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      title={org ? org.nombre : 'Nueva organización'}
      onClose={onClose}
      width="640px"
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
          <Field label="Tipo">
            <Select value={form.tipo} onChange={set('tipo')}>
              {Object.entries(TIPOS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Email de contacto">
            <Input type="email" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Teléfono">
            <Input value={form.telefono} onChange={set('telefono')} />
          </Field>
          <Field label="Plan">
            <Input value={form.plan} onChange={set('plan')} />
          </Field>
          <Field label="Máximo de profesionales (vacío = sin límite)">
            <Input type="number" min="1" value={form.max_profesionales} onChange={set('max_profesionales')} />
          </Field>
          {org && (
            <Check>
              <input type="checkbox" checked={form.activo} onChange={set('activo')} />
              Organización activa
            </Check>
          )}
        </Grid>

        {!org && (
          <>
            <h4 style={{ margin: '20px 0 4px' }}>Administrador</h4>
            <Muted $size="13px">Si el email ya tiene una cuenta en Agendip, se usa esa cuenta con su contraseña actual.</Muted>
            <Grid style={{ marginTop: 10 }}>
              <Field label="Nombre *">
                <Input value={form.admin.nombre} onChange={setAdmin('nombre')} />
              </Field>
              <Field label="Email *">
                <Input type="email" value={form.admin.email} onChange={setAdmin('email')} />
              </Field>
              <Field label="Contraseña (solo para una cuenta nueva)">
                <Input type="password" value={form.admin.password} onChange={setAdmin('password')} autoComplete="new-password" />
              </Field>
            </Grid>
          </>
        )}
        <button type="submit" hidden />
      </form>

      {org && (
        <>
          <h4 style={{ margin: '20px 0 8px' }}>Usuarios</h4>
          <Usuarios orgId={org.id} />
        </>
      )}
    </Modal>
  );
}

export default function Superadmin() {
  const { usuario, cambiarOrganizacion } = useAuth();
  const [lista, setLista] = useState(null);
  const [buscar, setBuscar] = useState('');
  const [modal, setModal] = useState(null);

  const cargar = useCallback(() => {
    api
      .get('/superadmin/organizaciones')
      .then((r) => setLista(r.data))
      .catch((err) => toast.error(errorMsg(err)));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const entrar = (o) => (e) => {
    e.stopPropagation();
    cambiarOrganizacion(o.id).catch((err) => toast.error(errorMsg(err)));
  };

  const filtro = buscar.trim().toLowerCase();
  const visibles = (lista || []).filter((o) => !filtro || o.nombre.toLowerCase().includes(filtro));

  return (
    <Page $max="1200px">
      <PageHeader title="Organizaciones" subtitle="Todos los consultorios y centros que usan Agendip">
        <Input placeholder="Buscar…" value={buscar} onChange={(e) => setBuscar(e.target.value)} style={{ width: 200 }} />
        <Button onClick={() => setModal({ org: null })}>
          <FiPlus /> Nueva organización
        </Button>
      </PageHeader>
      <TableWrap>
        {!lista ? (
          <Spinner />
        ) : !visibles.length ? (
          <Empty>No hay organizaciones</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Organización</th>
                <th>Plan</th>
                <th>Profesionales</th>
                <th>Usuarios</th>
                <th>Pacientes</th>
                <th>Turnos (30 días)</th>
                <th>Último acceso</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibles.map((o) => (
                <tr key={o.id} data-click onClick={() => setModal({ org: o })} style={{ opacity: o.activo ? 1 : 0.55 }}>
                  <td>
                    <strong>{o.nombre}</strong> {!o.activo && <Badge $color="#dc2626">Inactiva</Badge>}
                    {usuario.organizacion?.id === o.id && <Badge $color="#1d4ed8">Actual</Badge>}
                    <br />
                    <Muted $size="12px">
                      {TIPOS[o.tipo]} · desde {fechaCorta(o.creado_en)}
                    </Muted>
                  </td>
                  <td>{o.plan}</td>
                  <td>
                    {o.profesionales}
                    {o.max_profesionales ? <Muted $size="12px"> / {o.max_profesionales}</Muted> : null}
                  </td>
                  <td>{o.usuarios}</td>
                  <td>{o.pacientes}</td>
                  <td>{o.turnos_mes}</td>
                  <td>{o.ultimo_acceso ? fechaHora(o.ultimo_acceso) : <Muted>Nunca</Muted>}</td>
                  <td>
                    <Button $variant="secondary" onClick={entrar(o)} title="Entrar como administrador">
                      <FiLogIn /> Entrar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </TableWrap>
      {modal && (
        <OrganizacionModal
          org={modal.org}
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
