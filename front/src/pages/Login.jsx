import { useState } from 'react';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import api, { errorMsg } from '../api';
import { useAuth } from '../context/AuthContext';
import { Button, Field, Input, Select } from '../components/ui';
import { theme as t } from '../styles/GlobalStyle';

const Fondo = styled.div`
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  background: linear-gradient(160deg, #0f1d3a 0%, #1d4ed8 100%);
`;

const Caja = styled.form`
  width: 100%;
  max-width: 400px;
  background: #fff;
  border-radius: 16px;
  padding: 32px 28px;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  gap: 14px;
  h1 { font-size: 30px; text-align: center; letter-spacing: -0.03em; }
  h1 span { color: ${t.primary}; }
  p { text-align: center; color: ${t.muted}; margin: -8px 0 6px; }
`;

const Link = styled.button.attrs({ type: 'button' })`
  background: none;
  border: none;
  color: ${t.primary};
  cursor: pointer;
  font-weight: 500;
`;

export default function Login() {
  const { iniciar } = useAuth();
  const [modo, setModo] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', nombre: '', organizacion: '', tipo: 'consultorio' });
  const [enviando, setEnviando] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      const { data } = await api.post(modo === 'login' ? '/auth/login' : '/auth/registro', form);
      iniciar(data);
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
          Agend<span>ia</span>
        </h1>
        <p>{modo === 'login' ? 'Gestión de agendas y turnos' : 'Creá la cuenta de tu consultorio'}</p>
        {modo === 'registro' && (
          <>
            <Field label="Nombre del consultorio o centro">
              <Input value={form.organizacion} onChange={set('organizacion')} required />
            </Field>
            <Field label="Tipo">
              <Select value={form.tipo} onChange={set('tipo')}>
                <option value="consultorio">Consultorio</option>
                <option value="centro">Centro de atención</option>
                <option value="profesional_independiente">Profesional independiente</option>
              </Select>
            </Field>
            <Field label="Tu nombre">
              <Input value={form.nombre} onChange={set('nombre')} required />
            </Field>
          </>
        )}
        <Field label="Email">
          <Input type="email" autoComplete="username" value={form.email} onChange={set('email')} required />
        </Field>
        <Field label="Contraseña">
          <Input
            type="password"
            autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
            value={form.password}
            onChange={set('password')}
            minLength={modo === 'registro' ? 6 : undefined}
            required
          />
        </Field>
        <Button type="submit" disabled={enviando} style={{ marginTop: 6 }}>
          {enviando ? 'Procesando…' : modo === 'login' ? 'Ingresar' : 'Crear cuenta'}
        </Button>
        <Link onClick={() => setModo(modo === 'login' ? 'registro' : 'login')}>
          {modo === 'login' ? '¿No tenés cuenta? Registrá tu consultorio' : 'Ya tengo cuenta, ingresar'}
        </Link>
      </Caja>
    </Fondo>
  );
}
