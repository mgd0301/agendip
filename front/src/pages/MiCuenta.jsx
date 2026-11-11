import { useState } from 'react';
import toast from 'react-hot-toast';
import api, { errorMsg } from '../api';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Field, Grid, Input, Muted, Page, PageHeader } from '../components/ui';

const ROL = { admin: 'Administrador', recepcion: 'Recepción', profesional: 'Profesional' };

function Datos() {
  const { usuario, actualizar } = useAuth();
  const [form, setForm] = useState({ nombre: usuario.nombre, email: usuario.email, password_actual: '' });
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const cambiaEmail = form.email.trim().toLowerCase() !== usuario.email;

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const { data } = await api.put('/auth/perfil', form);
      actualizar(data);
      setForm({ nombre: data.nombre, email: data.email, password_actual: '' });
      toast.success('Datos guardados');
    } catch (err) {
      toast.error(errorMsg(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card as="form" onSubmit={guardar} style={{ marginBottom: 16 }}>
      <h3 style={{ marginBottom: 12 }}>Mis datos</h3>
      <Grid>
        <Field label="Nombre">
          <Input value={form.nombre} onChange={set('nombre')} required />
        </Field>
        <Field label="Email (es tu usuario para ingresar)">
          <Input type="email" value={form.email} onChange={set('email')} required />
        </Field>
        {cambiaEmail && (
          <Field label="Contraseña actual (para cambiar el email)">
            <Input type="password" value={form.password_actual} onChange={set('password_actual')} autoComplete="current-password" required />
          </Field>
        )}
      </Grid>
      <Button type="submit" disabled={guardando} style={{ marginTop: 14 }}>
        Guardar
      </Button>
    </Card>
  );
}

function Password() {
  const { guardarToken } = useAuth();
  const [form, setForm] = useState({ actual: '', nueva: '', repetir: '' });
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const guardar = async (e) => {
    e.preventDefault();
    if (form.nueva !== form.repetir) return toast.error('Las contraseñas nuevas no coinciden');
    setGuardando(true);
    try {
      const { data } = await api.put('/auth/password', { actual: form.actual, nueva: form.nueva });
      guardarToken(data.token);
      setForm({ actual: '', nueva: '', repetir: '' });
      toast.success('Contraseña cambiada. Se cerraron las sesiones abiertas en otros dispositivos.');
    } catch (err) {
      toast.error(errorMsg(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card as="form" onSubmit={guardar} style={{ marginBottom: 16 }}>
      <h3 style={{ marginBottom: 12 }}>Cambiar contraseña</h3>
      <Grid>
        <Field label="Contraseña actual">
          <Input type="password" value={form.actual} onChange={set('actual')} autoComplete="current-password" required />
        </Field>
        <div />
        <Field label="Contraseña nueva (mín. 6 caracteres)">
          <Input type="password" value={form.nueva} onChange={set('nueva')} autoComplete="new-password" minLength={6} required />
        </Field>
        <Field label="Repetir contraseña nueva">
          <Input type="password" value={form.repetir} onChange={set('repetir')} autoComplete="new-password" minLength={6} required />
        </Field>
      </Grid>
      <Button type="submit" disabled={guardando} style={{ marginTop: 14 }}>
        Cambiar contraseña
      </Button>
    </Card>
  );
}

export default function MiCuenta() {
  const { usuario } = useAuth();
  return (
    <Page $max="760px">
      <PageHeader title="Mi cuenta" subtitle="Tus datos de acceso a Agendip" />
      <Datos />
      <Password />
      {(usuario.organizaciones.length > 0 || usuario.es_superadmin) && (
        <Card>
          <h3 style={{ marginBottom: 8 }}>Mis consultorios</h3>
          {usuario.es_superadmin && <Muted as="p">Sos superadministrador del sistema.</Muted>}
          {usuario.organizaciones.map((o) => (
            <div key={o.id} style={{ padding: '6px 0' }}>
              <strong>{o.nombre}</strong> <Muted $size="13px">· {ROL[o.rol]}</Muted>
            </div>
          ))}
        </Card>
      )}
    </Page>
  );
}
