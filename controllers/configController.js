const fs = require('fs/promises');
const path = require('path');
const { throwError } = require('../helpers/errorLauncher');

// Ruta absoluta al archivo de configuración dentro de local_config
const CONFIG_FILE = path.join(__dirname, '..', 'local_config', 'config.json');

// Función auxiliar para asegurar que el directorio y archivo existen
const ensureConfigFile = async () => {
  const dir = path.dirname(CONFIG_FILE);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
  try {
    await fs.access(CONFIG_FILE);
  } catch {
    // Si no existe, crear con un objeto vacío
    await fs.writeFile(CONFIG_FILE, '{}', 'utf8');
  }
};

class ConfigController {
  /**
   * GET /config
   * Devuelve el contenido del archivo config.json (parseado como JSON)
   */
  async getConfig(req, res, next) {
    try {
      await ensureConfigFile();
      const raw = await fs.readFile(CONFIG_FILE, 'utf8');
      try {
        const json = JSON.parse(raw);
        return res.json(json);
      } catch (parseError) {
        // Si el archivo tiene JSON inválido, lanzamos error 500
        throwError('El archivo de configuración contiene JSON inválido', 500);
      }
    } catch (error) {
      // Si el error ya tiene status (lanzado por throwError), se pasa al manejador global
      if (error.status) {
        return next(error);
      }
      // Otros errores (permisos, etc.)
      next({ status: 500, message: 'Error al leer el archivo de configuración' });
    }
  }

  /**
   * PUT /config
   * Recibe un JSON en el body y lo guarda en config.json
   */
  async updateConfig(req, res, next) {
    try {
      const body = req.body;

      // Validar que el body no esté vacío
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throwError('El cuerpo de la petición debe ser un objeto JSON válido', 400);
      }

      // Verificar que no sea un objeto vacío (opcional, pero se puede permitir)
      if (Object.keys(body).length === 0) {
        throwError('El objeto de configuración no puede estar vacío', 400);
      }

      // Intentar serializar para validar que es JSON válido (ya lo es, pero por seguridad)
      const content = JSON.stringify(body, null, 2);

      await ensureConfigFile();
      await fs.writeFile(CONFIG_FILE, content, 'utf8');

      res.status(200).json({
        message: 'Configuración actualizada correctamente',
        data: body
      });
    } catch (error) {
      // Si es error lanzado por throwError, lo pasamos
      if (error.status) {
        return next(error);
      }
      // Otros errores
      next({ status: 500, message: 'Error al escribir el archivo de configuración' });
    }
  }
}

module.exports = new ConfigController();