import { useState } from 'react';
import toast from 'react-hot-toast';
import api, { errorMsg } from '../api';
import { Button, Field, Input } from '../components/ui';
import { Caja, Fondo } from '../components/Acceso';

// Llega desde el link del email de "olvidé mi contraseña": /restablecer?token=...
export default function Restablecer() {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [form, setForm] = useState({ password: '', repetir: '' });
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const ir = () => window.location.assign('/');

  const enviar = async (e) => {
    e.preventDefault();
    if (form.password !== form.repetir) return toast.error('Las contraseñas no coinciden');
    setEnviando(true);
    try {
      await api.post('/auth/restablecer', { token, password: form.password });
      setListo(true);
    } catch (err) {
      toast.error(errorMsg(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Fondo>
      <Caja onSubmit={enviar}>
        <h1>
          Agend<span>ip</span>
        </h1>
        {listo ? (
          <>
            <p>Listo, tu contraseña nueva ya está activa.</p>
            <Button onClick={ir}>Ingresar</Button>
          </>
        ) : !token ? (
          <>
            <p>El link está incompleto. Pedí uno nuevo desde «¿Olvidaste tu contraseña?».</p>
            <Button onClick={ir}>Volver</Button>
          </>
        ) : (
          <>
            <p>Elegí tu contraseña nueva</p>
            <Field label="Contraseña nueva (mín. 6 caracteres)">
              <Input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" minLength={6} required />
            </Field>
            <Field label="Repetir contraseña">
              <Input type="password" value={form.repetir} onChange={set('repetir')} autoComplete="new-password" minLength={6} required />
            </Field>
            <Button type="submit" disabled={enviando} style={{ marginTop: 6 }}>
              {enviando ? 'Guardando…' : 'Guardar contraseña'}
            </Button>
          </>
        )}
      </Caja>
    </Fondo>
  );
}
