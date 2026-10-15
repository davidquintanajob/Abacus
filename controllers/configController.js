const fs = require('fs/promises');
const path = require('path');
const { throwError } = require('../helpers/errorLauncher');
const sequelize = require('../helpers/database');
const { Servicio } = require('../models/servicio');
const { Producto } = require('../models/producto');
const { ServicioTienda } = require('../models/servicio_tienda');
const axios = require('axios');
const { Op } = require('sequelize');

// Ruta absoluta al archivo de configuración dentro de local_config
const CONFIG_FILE = path.join(__dirname, '..', 'local_config', 'config.json');
const LOGO_DIR = path.join(__dirname, '..', 'local_config_logo');
const LOGO_FILE = path.join(LOGO_DIR, 'logo.web');
const AUDIT_LOG_FILE = path.join(__dirname, '..', 'logs', 'audit.log');

// Función auxiliar para manejar errores (igual que en usuarioController)
const handleError = (res, error) => {
  const status = error.status || 500;
  const message = error.message || 'Error interno del servidor';
  let errors = error.errors;
  if (!Array.isArray(errors) || errors.length === 0) {
    errors = [message];
  }
  errors = errors.map(e => typeof e === 'string' ? e : String(e));
  res.status(status).json({ errors });
};

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
    await fs.writeFile(CONFIG_FILE, '{}', 'utf8');
  }
};

// --- Función para parsear una línea del audit.log ---
const parseAuditLine = (line) => {
  // Formato esperado:
  // "2026-09-03 09:10:47 | Usuario: 1 (David Quintana ) | Endpoint: GET /servicio/filter?limit=10&page=1&fetchProducto=true | Req: 0.00000 KB | Res: 8.24707 KB"
  const parts = line.split(' | ');
  if (parts.length < 5) return null;
  const timestamp = parts[0].trim();
  const usuarioPart = parts[1].trim();
  const usuario = usuarioPart.replace('Usuario: ', '').trim();
  const endpointPart = parts[2].trim();
  const endpoint = endpointPart.replace('Endpoint: ', '').trim();
  const reqPart = parts[3].trim();
  const resPart = parts[4].trim();

  const reqMatch = reqPart.match(/Req:\s*([\d.]+)\s*KB/);
  const resMatch = resPart.match(/Res:\s*([\d.]+)\s*KB/);

  if (!reqMatch || !resMatch) return null;
  const reqSizeKB = parseFloat(reqMatch[1]);
  const resSizeKB = parseFloat(resMatch[1]);

  return { timestamp, usuario, endpoint, reqSizeKB, resSizeKB };
};

const normalizeAuditDate = (value, parameter, endOfDay = false) => {
  const match = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?$/.exec(value);
  if (!match) {
    throwError(`${parameter} debe tener formato YYYY-MM-DD o YYYY-MM-DD HH:mm:ss`, 400);
  }

  const date = new Date(`${match[1]}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== match[1]) {
    throwError(`${parameter} no es una fecha válida`, 400);
  }

  if (!match[2]) {
    return `${match[1]} ${endOfDay ? '23:59:59' : '00:00:00'}`;
  }

  const [, , hours, minutes, seconds] = match;
  if (Number(hours) > 23 || Number(minutes) > 59 || Number(seconds) > 59) {
    throwError(`${parameter} no es una fecha válida`, 400);
  }

  return `${match[1]} ${hours}:${minutes}:${seconds}`;
};

const findFirstAuditLine = (lines, timestamp, strictlyAfter = false) => {
  let low = 0;
  let high = lines.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const lineTimestamp = lines[middle].slice(0, 19);
    if (lineTimestamp < timestamp || (strictlyAfter && lineTimestamp === timestamp)) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
};

const formatAuditSize = (sizeKB) => {
  const sizeBytes = sizeKB * 1024;
  let valor;
  let unidad;

  if (sizeBytes < 1024 ** 2) {
    valor = sizeKB;
    unidad = 'KB';
  } else if (sizeBytes < 1024 ** 3) {
    valor = sizeBytes / (1024 ** 2);
    unidad = 'MB';
  } else {
    valor = sizeBytes / (1024 ** 3);
    unidad = 'GB';
  }

  return { valor: Number(valor.toFixed(5)), unidad };
};

class ConfigController {
  /**
   * GET /config
   * Devuelve el contenido del archivo config.json (parseado como JSON)
   */
  async getConfig(req, res) {
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
      handleError(res, error);
    }
  }

  /**
   * PUT /config/logo
   * Guarda o reemplaza el logo recibido como Base64 en local_config_logo/logo.web.
   */
  async updateLogo(req, res) {
    try {
      const body = req.body || {};
      const { imagen } = body;

      if (Object.keys(body).length !== 1 || typeof imagen !== 'string' || imagen.trim() === '') {
        throwError('La petición debe contener únicamente el campo imagen como cadena Base64 no vacía', 400);
      }

      const base64Imagen = imagen.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Imagen) || base64Imagen.length % 4 === 1) {
        throwError('El campo imagen no contiene una imagen Base64 válida', 400);
      }

      const contenidoImagen = Buffer.from(base64Imagen.padEnd(Math.ceil(base64Imagen.length / 4) * 4, '='), 'base64');
      if (contenidoImagen.length === 0) {
        throwError('El campo imagen no contiene datos', 400);
      }

      await fs.mkdir(LOGO_DIR, { recursive: true });
      await fs.writeFile(LOGO_FILE, contenidoImagen);

      res.status(200).json({
        message: 'Logo almacenado correctamente',
        archivo: 'logo.web',
        url: '/local_config_logo/logo.web',
      });
    } catch (error) {
      handleError(res, error);
    }
  }

  /**
   * PUT /config
   * Recibe un JSON en el body y lo guarda en config.json.
   * Si el body contiene una propiedad `monedaConfig`, esta se valida, se procesa
   * (actualizando los registros de servicio_tienda según la lógica definida) y
   * **no** se guarda en el archivo. El resto de las propiedades se persisten normalmente.
   */
  async updateConfig(req, res) {
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

      // --- Manejo especial de monedaConfig ---
      if (body.monedaConfig !== undefined) {
        const moneda = body.monedaConfig;

        // Validaciones
        if (typeof moneda !== 'object' || Array.isArray(moneda) || moneda === null) {
          throwError('monedaConfig debe ser un objeto', 400);
        }

        const {
          modificarSoloServicios,
          datosModificar,
          tipoDatoModificar,
          monedaValor,
          redondeo_exeso: redondeoExeso
        } = moneda;

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
        if (redondeoExeso !== undefined &&
            (!Number.isInteger(redondeoExeso) || redondeoExeso <= 0)) {
          throwError('monedaConfig.redondeo_exeso debe ser un número entero positivo', 400);
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
              transaction
            });
            servicioIds = results.map(r => r.id_servicio);
            console.log(`🔍 Servicios sin producto encontrados: ${servicioIds.length}`);
            if (servicioIds.length === 0) {
              console.warn('⚠️ No hay servicios sin producto. No se actualizará ningún registro.');
            }
          } else {
            console.log('🔍 Se actualizarán TODOS los servicios (incluyendo productos).');
          }

          // 2. Construir los campos a actualizar
          const updateFields = {};
          const factor = monedaValor;

          // Función para redondear a 5 decimales usando SQL
          const round5 = (expr) => sequelize.literal(`ROUND(${expr}, 5)`);
          const roundCupValue = (expr) => {
            if (redondeoExeso === undefined) {
              return round5(expr);
            }
            return round5(`CEIL((${expr}) / ${redondeoExeso}) * ${redondeoExeso}`);
          };

          if (tipoDatoModificar === 'usd') {
            // Actualizar USD a partir de CUP
            if (datosModificar === 'precios' || datosModificar === 'ambos') {
              updateFields.precio_usd = round5(`precio_cup / ${factor}`);
            }
            if (datosModificar === 'costos' || datosModificar === 'ambos') {
              updateFields.costo_usd = round5(`costo_cup / ${factor}`);
            }
          } else { // 'cup'
            // Actualizar CUP a partir de USD
            if (datosModificar === 'precios' || datosModificar === 'ambos') {
              updateFields.precio_cup = roundCupValue(`precio_usd * ${factor}`);
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
      handleError(res, error);
    }
  }

  /**
   * GET /config/tasa-cambio
   * Consume la API externa de tasas y devuelve la respuesta.
   * Si ocurre cualquier error, se responde con un mensaje fijo.
   */
  async getTasaCambio(req, res) {
    try {
      const url = 'https://tasas.eltoque.com/v1/trmi';
      const token = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc3MDczMDQ4NCwianRpIjoiMDM3YmVmYWEtNTc0OS00MjliLWExMDctNTI3ODI4NzZiY2M1IiwidHlwZSI6ImFjY2VzcyIsInN1YiI6IjY5ODAxYjgwYzFkYjdhMjU4OWQxN2YzZiIsIm5iZiI6MTc3MDczMDQ4NCwiZXhwIjoxODAyMjY2NDg0fQ.b0YJPqe4_NCYwVE-5w-cJfmDMoQ2Kx2vTb8WOmI9khs';

      const response = await axios.get(url, {
        headers: { 'Authorization': token },
        timeout: 10000
      });

      return res.status(200).json(response.data);
    } catch (error) {
      console.error('Error al consumir API de tasas:', error.message);
      // Llamamos directamente a handleError con el error personalizado
      return handleError(res, {
        status: 400,
        message: 'el servidor de Abacus no se ha podido conectar con ElToque'
      });
    }
  }

  /**
   * GET /config/audit-logs
   * Lee el archivo audit.log, aplica filtros y devuelve los registros y sumatorias.
   */
  async getAuditLogs(req, res) {
    try {
      const { usuario, endpoint, fecha_desde, fecha_hasta } = req.query;

      // Verificar que el archivo existe
      try {
        await fs.access(AUDIT_LOG_FILE);
      } catch {
        return res.status(404).json({ errors: ['Archivo de auditoría no encontrado'] });
      }

      // Leer el archivo línea por línea
      const content = await fs.readFile(AUDIT_LOG_FILE, 'utf8');
      const lines = content.split('\n').filter(line => line.trim() !== '');

      // Parsear cada línea
      const parsedLines = [];
      for (const line of lines) {
        const parsed = parseAuditLine(line);
        if (parsed) {
          parsedLines.push(parsed);
        }
      }

      // Aplicar filtros
      let filtered = parsedLines;

      // Filtro por usuario (búsqueda parcial en el campo usuario)
      if (usuario) {
        const usuarioLower = usuario.toLowerCase();
        filtered = filtered.filter(entry => entry.usuario.toLowerCase().includes(usuarioLower));
      }

      // Filtro por endpoint (búsqueda parcial en el campo endpoint)
      if (endpoint) {
        const endpointLower = endpoint.toLowerCase();
        filtered = filtered.filter(entry => entry.endpoint.toLowerCase().includes(endpointLower));
      }

      const start = fecha_desde
        ? normalizeAuditDate(fecha_desde, 'fecha_desde')
        : null;
      const end = fecha_hasta
        ? normalizeAuditDate(fecha_hasta, 'fecha_hasta', true)
        : null;
      if (start && end && start > end) {
        throwError('fecha_desde debe ser anterior o igual a fecha_hasta', 400);
      }
      if (start) {
        filtered = filtered.filter(entry => entry.timestamp >= start);
      }
      if (end) {
        filtered = filtered.filter(entry => entry.timestamp <= end);
      }

      // Ordenar por timestamp (más reciente primero)
      filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Calcular sumatorias
      let totalReqKB = 0;
      let totalResKB = 0;
      for (const entry of filtered) {
        totalReqKB += entry.reqSizeKB;
        totalResKB += entry.resSizeKB;
      }

      // Convertir a MB y GB
      const totalReqMB = totalReqKB / 1024;
      const totalResMB = totalResKB / 1024;
      const totalReqGB = totalReqMB / 1024;
      const totalResGB = totalResMB / 1024;

      // Respuesta
      res.status(200).json({
        datos: filtered,
        sumatorias: {
          totalReqKB,
          totalResKB,
          totalReqMB,
          totalResMB,
          totalReqGB,
          totalResGB,
        }
      });

    } catch (error) {
      handleError(res, error);
    }
  }

  /**
   * GET /config/audit-logs/summary
   * Suma el tráfico por usuario dentro de un rango de fechas del audit.log.
   */
  async getAuditLogSummary(req, res) {
    try {
      const { id_usuario, fecha_desde, fecha_hasta } = req.query;
      if (typeof id_usuario !== 'string' || !id_usuario.trim()) {
        throwError('id_usuario es obligatorio', 400);
      }
      if (typeof fecha_desde !== 'string' || !fecha_desde.trim()) {
        throwError('fecha_desde es obligatoria', 400);
      }
      if (typeof fecha_hasta !== 'string' || !fecha_hasta.trim()) {
        throwError('fecha_hasta es obligatoria', 400);
      }

      const start = normalizeAuditDate(fecha_desde.trim(), 'fecha_desde');
      const end = normalizeAuditDate(fecha_hasta.trim(), 'fecha_hasta', true);
      if (start > end) {
        throwError('fecha_desde debe ser anterior o igual a fecha_hasta', 400);
      }

      let content;
      try {
        content = await fs.readFile(AUDIT_LOG_FILE, 'utf8');
      } catch (error) {
        if (error.code === 'ENOENT') {
          throwError('Archivo de auditoría no encontrado', 404);
        }
        throw error;
      }
      const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
      const rangeStart = findFirstAuditLine(lines, start);
      const rangeEnd = findFirstAuditLine(lines, end, true);
      let totalReqKB = 0;
      let totalResKB = 0;
      const userId = id_usuario.trim();

      for (let index = rangeStart; index < rangeEnd; index += 1) {
        const entry = parseAuditLine(lines[index]);
        if (!entry) continue;

        const entryUserId = /^(\d+)(?:\s|$)/.exec(entry.usuario)?.[1];
        if (entryUserId !== userId) continue;

        totalReqKB += entry.reqSizeKB;
        totalResKB += entry.resSizeKB;
      }

      return res.status(200).json({
        id_usuario: userId,
        fecha_desde: start,
        fecha_hasta: end,
        sumatorias: {
          totalReq: formatAuditSize(totalReqKB),
          totalRes: formatAuditSize(totalResKB),
        },
      });
    } catch (error) {
      handleError(res, error);
    }
  }
}

module.exports = new ConfigController();