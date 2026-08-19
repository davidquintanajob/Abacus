const fs = require('fs/promises');
const path = require('path');
const { throwError } = require('../helpers/errorLauncher');
const sequelize = require('../helpers/database');
const { Servicio } = require('../models/servicio');
const { Producto } = require('../models/producto');
const { ServicioTienda } = require('../models/servicio_tienda');
const { Op } = require('sequelize');

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
        throwError('El archivo de configuración contiene JSON inválido', 500);
      }
    } catch (error) {
      if (error.status) {
        return next(error);
      }
      next({ status: 500, message: 'Error al leer el archivo de configuración' });
    }
  }

  /**
   * PUT /config
   * Recibe un JSON en el body y lo guarda en config.json.
   * Si el body contiene una propiedad `monedaConfig`, esta se valida, se procesa
   * (actualizando los registros de servicio_tienda según la lógica definida) y
   * **no** se guarda en el archivo. El resto de las propiedades se persisten normalmente.
   */
  async updateConfig(req, res, next) {
    try {
      const body = req.body;

      // Validar que el body no esté vacío
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throwError('El cuerpo de la petición debe ser un objeto JSON válido', 400);
      }

      if (Object.keys(body).length === 0) {
        throwError('El objeto de configuración no puede estar vacío', 400);
      }

      // --- Copia para guardar (sin monedaConfig) ---
      let configToSave = { ...body };
      let updatedCount = 0;
      let affectedServiceIds = null; // para depuración

      // --- Manejo especial de monedaConfig ---
      if (body.monedaConfig !== undefined) {
        const moneda = body.monedaConfig;

        // Validaciones
        if (typeof moneda !== 'object' || Array.isArray(moneda) || moneda === null) {
          throwError('monedaConfig debe ser un objeto', 400);
        }

        const { modificarSoloServicios, datosModificar, tipoDatoModificar, monedaValor } = moneda;

        if (typeof modificarSoloServicios !== 'boolean') {
          throwError('monedaConfig.modificarSoloServicios debe ser un booleano', 400);
        }
        if (typeof datosModificar !== 'string' || !['costos', 'precios', 'ambos'].includes(datosModificar)) {
          throwError('monedaConfig.datosModificar debe ser "costos", "precios" o "ambos"', 400);
        }
        if (typeof tipoDatoModificar !== 'string' || !['cup', 'usd'].includes(tipoDatoModificar)) {
          throwError('monedaConfig.tipoDatoModificar debe ser "cup" o "usd"', 400);
        }
        if (typeof monedaValor !== 'number' || monedaValor <= 0) {
          throwError('monedaConfig.monedaValor debe ser un número mayor que 0', 400);
        }

        // --- Inicio de la transacción para actualización masiva ---
        const transaction = await sequelize.transaction();
        try {
          // 1. Obtener los IDs de servicio a modificar
          let servicioIds = null; // null = todos

          if (modificarSoloServicios === true) {
            // Servicios que NO tienen producto asociado
            const results = await Servicio.findAll({
              attributes: ['id_servicio'],
              where: {
                id_servicio: {
                  [Op.notIn]: sequelize.literal('(SELECT id_servicio FROM productos)')
                }
              },
              raw: true,
              transaction // <- importante usar la misma transacción para consistencia
            });
            servicioIds = results.map(r => r.id_servicio);
            console.log(`🔍 Servicios sin producto encontrados: ${servicioIds.length}`);
            if (servicioIds.length === 0) {
              console.warn('⚠️ No hay servicios sin producto. No se actualizará ningún registro.');
              // No lanzamos error, simplemente no habrá actualizaciones
            }
          } else {
            console.log('🔍 Se actualizarán TODOS los servicios (incluyendo productos).');
          }

          // 2. Construir los campos a actualizar
          const updateFields = {};
          const factor = monedaValor;

          // Función para redondear a 5 decimales usando SQL
          const round5 = (expr) => sequelize.literal(`ROUND(${expr}, 5)`);

          if (tipoDatoModificar === 'usd') {
            // Actualizar USD a partir de CUP
            if (datosModificar === 'precios' || datosModificar === 'ambos') {
              updateFields.precio_usd = round5(`precio_cup / ${factor}`);
            }
            if (datosModificar === 'costos' || datosModificar === 'ambos') {
              updateFields.costo_usd = round5(`costo_cup / ${factor}`);
            }
          } else { // 'usd'
            // Actualizar CUP a partir de USD
            if (datosModificar === 'precios' || datosModificar === 'ambos') {
              updateFields.precio_cup = round5(`precio_usd * ${factor}`);
            }
            if (datosModificar === 'costos' || datosModificar === 'ambos') {
              updateFields.costo_cup = round5(`costo_usd * ${factor}`);
            }
          }

          if (Object.keys(updateFields).length === 0) {
            throwError('No se generaron campos para actualizar. Verifica los parámetros.', 400);
          }

          console.log('📝 Campos a actualizar:', Object.keys(updateFields).join(', '));

          // 3. Construir la condición WHERE
          const whereCondition = servicioIds
            ? { id_servicio: { [Op.in]: servicioIds } }
            : {};

          // 4. Ejecutar la actualización
          const [affectedRows] = await ServicioTienda.update(updateFields, {
            where: whereCondition,
            transaction
          });

          updatedCount = affectedRows;
          console.log(`✅ Se actualizaron ${updatedCount} registros en servicio_tienda.`);

          // Confirmar la transacción
          await transaction.commit();

        } catch (dbError) {
          // Rollback en caso de error
          await transaction.rollback();
          console.error('❌ Error en transacción de actualización:', dbError);
          throwError('Error al actualizar los precios/costos en la base de datos', 500);
        }

        // --- Eliminar monedaConfig del objeto a guardar ---
        delete configToSave.monedaConfig;
      }

      // --- Guardar la configuración (excluyendo monedaConfig) ---
      const content = JSON.stringify(configToSave, null, 2);
      await ensureConfigFile();
      await fs.writeFile(CONFIG_FILE, content, 'utf8');

      // Respuesta exitosa
      res.status(200).json({
        message: 'Configuración actualizada correctamente',
        data: configToSave,
        ...(updatedCount > 0 && { updatedServiciosTienda: updatedCount })
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