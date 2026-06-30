/* global process */
const { Sequelize } = require('sequelize');
require('dotenv').config();

// Cargar explícitamente el módulo pg
const pg = require('pg');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres', // ← Cambia esto de process.env.DB_DIALECT a 'postgres'
    dialectModule: pg,   // ← Esto es CRUCIAL para pkg
    logging: false,
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

// Prueba de conexión
sequelize.authenticate()
  .then(() => console.log('✅ Conexión a PostgreSQL establecida'))
  .catch(err => console.error('❌ Error de conexión a la BD:', err));

module.exports = sequelize;