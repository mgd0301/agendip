// Marca (o desmarca) una cuenta como superadministrador del sistema.
//
//   npm run superadmin -- persona@mail.com "Nombre"   -> la hace superadmin (si la cuenta
//                                                       no existe, la crea con una contraseña
//                                                       provisoria que se muestra en pantalla)
//   npm run superadmin -- persona@mail.com quitar     -> le quita el permiso
//   npm run superadmin                                -> lista los superadmins actuales
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const { pool, query } = require('../db');

async function main() {
  const [emailArg, segundo] = process.argv.slice(2);
  if (!emailArg) {
    const lista = await query('SELECT email, nombre FROM usuarios WHERE es_superadmin = 1 ORDER BY email');
    console.log(lista.length ? lista.map((u) => `${u.email} (${u.nombre})`).join('\n') : 'No hay superadministradores.');
    return;
  }
  const email = emailArg.trim().toLowerCase();

  if (segundo === 'quitar') {
    const r = await query('UPDATE usuarios SET es_superadmin = 0 WHERE email = ?', [email]);
    if (!r.affectedRows) throw new Error(`No existe una cuenta con el email ${email}`);
    console.log(`${email} ya no es superadministrador.`);
    return;
  }

  const [cuenta] = await query('SELECT id FROM usuarios WHERE email = ?', [email]);
  if (cuenta) {
    await query('UPDATE usuarios SET es_superadmin = 1 WHERE id = ?', [cuenta.id]);
    console.log(`${email} ahora es superadministrador.`);
    return;
  }

  const password = crypto.randomBytes(9).toString('base64url');
  await query('INSERT INTO usuarios (nombre, email, password_hash, es_superadmin) VALUES (?, ?, ?, 1)', [
    segundo || 'Superadministrador',
    email,
    await bcrypt.hash(password, 10),
  ]);
  console.log(`Cuenta creada: ${email}\nContraseña provisoria: ${password}\nCámbiela desde "Mi cuenta" después de ingresar.`);
}

main()
  .catch((err) => {
    console.error(`ERROR: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
