const mysql = require('mysql2/promise');
require('dotenv').config({ quiet: true });

// MySQL 5.0 no soporta utf8mb4: se fuerza utf8 en la conexión.
// dateStrings: las fechas viajan como texto 'YYYY-MM-DD HH:MM:SS' (hora local del consultorio),
// así se evitan corrimientos por zona horaria entre servidor, base y navegador.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'agendia',
  charset: 'UTF8_GENERAL_CI',
  dateStrings: true,
  connectionLimit: 10,
  waitForConnections: true,
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

module.exports = { pool, query, transaction };
