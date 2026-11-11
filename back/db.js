const mysql = require('mysql2/promise');
require('dotenv').config({ quiet: true });
const { desfasajeUTC } = require('./utils/fechas');

// MySQL 5.0 no soporta utf8mb4: se fuerza utf8 en la conexión.
// dateStrings: las fechas viajan como texto 'YYYY-MM-DD HH:MM:SS' (hora local del consultorio),
// así se evitan corrimientos por zona horaria entre servidor, base y navegador.
// Datos de conexión: las variables DB_* del .env o, si faltan, las que Railway
// crea solo al agregar una base MySQL al proyecto (MYSQLHOST, MYSQLPORT, ...).
const env = process.env;
const conexion = {
  host: env.DB_HOST || env.MYSQLHOST || 'localhost',
  port: Number(env.DB_PORT || env.MYSQLPORT) || 3306,
  user: env.DB_USER || env.MYSQLUSER || 'root',
  password: env.DB_PASSWORD || env.MYSQLPASSWORD || '',
  database: env.DB_NAME || env.MYSQLDATABASE || 'agendia',
  charset: 'UTF8_GENERAL_CI',
};

const pool = mysql.createPool({
  ...conexion,
  dateStrings: true,
  connectionLimit: 10,
  waitForConnections: true,
});

// La sesión de MySQL usa la hora de los consultorios: así los valores por defecto
// (creado_en = CURRENT_TIMESTAMP) coinciden con las horas que guarda la aplicación.
pool.pool.on('connection', (conn) => {
  conn.query(`SET time_zone = '${desfasajeUTC()}'`);
});

async function query(sql, params, conn = pool) {
  const [rows] = await conn.query(sql, params);
  return rows;
}

async function transaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, query, transaction, conexion };
