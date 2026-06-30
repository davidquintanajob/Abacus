// helpers/logger.js
const winston = require('winston');

// Definir niveles personalizados
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    login: 2,  // Nivel personalizado para login
    debug: 3
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    login: 'blue',  // Color para login
    debug: 'gray'
  }
};

// Crear el logger
const logger = winston.createLogger({
  levels: customLevels.levels,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'logs/app.log'
    })
  ],
});

// Agregar colores (opcional para consola)
winston.addColors(customLevels.colors);

module.exports = logger;