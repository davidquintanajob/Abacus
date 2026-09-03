// helpers/auditLogger.js
const winston = require('winston');
const path = require('path');

const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.printf(({ timestamp, message, ...meta }) => {
      const usuario = meta.usuario || 'anonimo';
      const endpoint = meta.endpoint || 'desconocido';
      const reqSize = meta.reqSize !== undefined ? meta.reqSize : 0;
      const resSize = meta.resSize !== undefined ? meta.resSize : 0;
      // Cambiado a 5 decimales
      return `${timestamp} | Usuario: ${usuario} | Endpoint: ${endpoint} | Req: ${reqSize.toFixed(5)} KB | Res: ${resSize.toFixed(5)} KB`;
    })
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/audit.log'),
      maxsize: 5242880, // 5 MB
      maxFiles: 5,
      tailable: true,
    })
  ]
});

module.exports = { auditLogger };