// Marca (o desmarca) una cuenta como superadministrador del sistema.
//
//   npm run superadmin -- persona@mail.com           -> la hace superadmin
//   npm run superadmin -- persona@mail.com quitar    -> le quita el permiso
//   npm run superadmin                               -> lista los superadmins actuales
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const { pool, query } = require('../db');

async function main() {
  const [email, accion] = process.argv.slice(2);
  if (!email) {
    const lista = await query('SELECT email, nombre FROM usuarios WHERE es_superadmin = 1 ORDER BY email');
    console.log(lista.length ? lista.map((u) => `${u.email} (${u.nombre})`).join('\n') : 'No hay superadministradores.');
    return;
  }
  const valor = accion === 'quitar' ? 0 : 1;
  const r = await query('UPDATE usuarios SET es_superadmin = ? WHERE email = ?', [valor, email.trim().toLowerCase()]);
  if (!r.affectedRows) throw new Error(`No existe una cuenta con el email ${email}`);
  console.log(valor ? `${email} ahora es superadministrador.` : `${email} ya no es superadministrador.`);
}

main()
  .catch((err) => {
    console.error(`ERROR: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
