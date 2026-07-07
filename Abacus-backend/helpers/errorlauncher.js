// helpers/errorLauncher.js

/**
 * Lanza un error con formato estandarizado para toda la API.
 * @param {string} message - Mensaje principal del error.
 * @param {number} status - Código HTTP (default: 500).
 * @param {Array<string>|string} errors - Lista de detalles adicionales (opcional).
 * @throws {Error} - El error lanzado tendrá las propiedades: message, status, errors.
 */
function throwError(message, status = 500, errors = []) {
  const error = new Error(message);
  error.status = status;

  // Asegurar que errors sea un array y que tenga al menos un elemento
  let errorArray = Array.isArray(errors) ? errors : [errors];
  // Si el array está vacío, usar el mensaje principal como error
  if (errorArray.length === 0) {
    errorArray = [message];
  }
  error.errors = errorArray;

  throw error;
}

module.exports = { throwError };