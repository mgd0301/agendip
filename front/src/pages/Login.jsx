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

const Opcion = styled.button.attrs({ type: 'button' })`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid ${(p) => (p.$marcada ? t.primary : t.border)};
  border-radius: 10px;
  background: ${(p) => (p.$marcada ? '#eff6ff' : '#fff')};
  cursor: pointer;
  text-align: left;
  font-size: 15px;
  font-weight: 500;
  color: ${t.text};
  small { color: ${t.muted}; font-weight: 400; font-size: 12px; }
  &:hover { border-color: ${t.primary}; }
  &:disabled { opacity: 0.6; cursor: wait; }
`;

const ROL = { admin: 'Administrador', recepcion: 'Recepción', profesional: 'Profesional' };

export default function Login() {
  const { iniciar } = useAuth();
  const [modo, setModo] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', nombre: '', organizacion: '', tipo: 'consultorio' });
  const [enviando, setEnviando] = useState(false);
  // Cuando la cuenta trabaja en varios consultorios, el servidor pide elegir en cuál entrar.
  const [eleccion, setEleccion] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      const { data } = await api.post(modo === 'login' ? '/auth/login' : '/auth/registro', form);
      if (data.elegir) setEleccion(data);
      else iniciar(data);
    } catch (err) {
      toast.error(errorMsg(err));
    } finally {
      setEnviando(false);
    }
  };

  const entrar = async (organizacionId) => {
    setEnviando(true);
    try {
      const { data } = await api.post('/auth/login', { email: form.email, password: form.password, organizacion_id: organizacionId });
      iniciar(data);
    } catch (err) {
      toast.error(errorMsg(err));
      setEnviando(false);
    }
  };

  if (eleccion) {
    return (
      <Fondo>
        <Caja as="div">
          <h1>
            Agend<span>ip</span>
          </h1>
          <p>¿En qué consultorio vas a trabajar?</p>
          {eleccion.organizaciones.map((o) => (
            <Opcion key={o.id} $marcada={o.id === eleccion.ultima} disabled={enviando} onClick={() => entrar(o.id)}>
              {o.nombre}
              <small>{ROL[o.rol]}</small>
            </Opcion>
          ))}
          {eleccion.es_superadmin && (
            <Opcion disabled={enviando} onClick={() => entrar(0)}>
              Panel de superadministrador
              <small>Todas las organizaciones</small>
            </Opcion>
          )}
          <Link
            onClick={() => {
              setEleccion(null);
              setForm({ ...form, password: '' });
            }}
          >
            Ingresar con otra cuenta
          </Link>
        </Caja>
      </Fondo>
    );
  }

  return (
    <Fondo>
      <Caja onSubmit={enviar}>
        <h1>
          Agend<span>ip</span>
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
