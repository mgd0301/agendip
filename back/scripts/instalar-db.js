// Ejecuta los scripts de /database contra el servidor configurado en .env.
// Sirve como alternativa al cliente mysql.exe 8.0, que no puede autenticarse contra MySQL 5.0.
//
//   npm run db:instalar          -> crea la estructura (01_estructura.sql)
//   npm run db:instalar -- demo  -> además carga los datos de prueba (02_datos_demo.sql)
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const DIR = path.join(__dirname, '..', '..', 'database');
const archivos = ['01_estructura.sql', ...(process.argv.includes('demo') ? ['02_datos_demo.sql'] : [])];

async function main() {
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'root';
  console.log(`Conectando a ${user}@${host}:${process.env.DB_PORT || 3306} ...`);

  // Sin "database": la base todavía puede no existir; los scripts hacen CREATE DATABASE / USE.
  const conn = await mysql.createConnection({
    host,
    port: Number(process.env.DB_PORT) || 3306,
    user,
    password: process.env.DB_PASSWORD || '',
    charset: 'UTF8_GENERAL_CI',
    multipleStatements: true,
  });
  const [[{ v }]] = await conn.query('SELECT VERSION() AS v');
  console.log(`Conectado. Versión del servidor: ${v}`);

  for (const archivo of archivos) {
    process.stdout.write(`Ejecutando ${archivo} ... `);
    await conn.query(fs.readFileSync(path.join(DIR, archivo), 'utf8'));
    console.log('OK');
  }

  const db = process.env.DB_NAME || 'agendia';
  const [tablas] = await conn.query(`SHOW TABLES FROM \`${db}\``);
  console.log(`Base "${db}" lista con ${tablas.length} tablas.`);
  await conn.end();
}

main().catch((err) => {
  console.log('');
  console.error(`ERROR: ${err.code || ''} ${err.message}`);
  if (err.code === 'ER_ACCESS_DENIED_ERROR') console.error('Revise DB_USER y DB_PASSWORD en back/.env');
  if (err.code === 'ER_DBACCESS_DENIED_ERROR') console.error('El usuario no tiene permiso para crear la base: pida un GRANT o créela con root.');
  process.exit(1);
});
