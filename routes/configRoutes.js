const { Router } = require('express');
const configController = require('../controllers/configController');
const authenticate = require("../helpers/authenticate");

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Configuración
 *   description: Gestión del archivo de configuración local
 */

/**
 * @swagger
 * /config:
 *   get:
 *     summary: Obtener la configuración actual desde local_config/config.json
 *     tags: [Configuración]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Objeto de configuración (o {} si el archivo no existe)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: true
 *       500:
 *         description: Error interno del servidor
 */
router.get('/', authenticate(), configController.getConfig);

/**
 * @swagger
 * /config/logo:
 *   put:
 *     summary: Almacenar o actualizar el logo de la aplicación
 *     tags: [Configuración]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - imagen
 *             properties:
 *               imagen:
 *                 type: string
 *                 description: Imagen codificada en Base64, con o sin prefijo data URI
 *     responses:
 *       200:
 *         description: Logo almacenado correctamente
 *       400:
 *         description: Imagen Base64 inválida
 */
router.put('/logo', authenticate(), configController.updateLogo);

/**
 * @swagger
 * /config:
 *   put:
 *     summary: Actualizar el archivo de configuración
 *     description: |
 *       Permite actualizar la configuración general. 
 *       
 *       **Nota sobre `monedaConfig`**:  
 *       Si se envía una propiedad `monedaConfig` en el cuerpo, esta se procesa de forma especial: 
 *       se valida su estructura, se imprime en consola (por ahora) y **no** se guarda en el archivo. 
 *       El resto de las propiedades se persisten normalmente.
 *       
 *       **Campos obligatorios de `monedaConfig` y sus valores válidos:**
 *       - `modificarSoloServicios`: booleano (`true` o `false`).
 *       - `datosModificar`: string, debe ser exactamente `"costos"`, `"precios"` o `"ambos"`.
 *       - `tipoDatoModificar`: string, debe ser `"cup"` o `"usd"`.
 *       - `monedaValor`: número mayor que 0 (p.ej., `1.5`).
 *       
 *       Si alguno de estos campos no cumple con el tipo o valor esperado, la petición será rechazada con un error 400.
 *     tags: [Configuración]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *           example:
 *             clave: "valor"
 *             otro: 123
 *             monedaConfig:
 *               modificarSoloServicios: true
 *               datosModificar: "costos"
 *               tipoDatoModificar: "cup"
 *               monedaValor: 1.5
 *     responses:
 *       200:
 *         description: Configuración actualizada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   additionalProperties: true
 *       400:
 *         description: |
 *           El cuerpo no es un JSON válido, está vacío, o `monedaConfig` tiene un formato inválido.
 *           Los errores específicos para `monedaConfig` pueden ser:
 *           - Debe ser un objeto
 *           - modificarSoloServicios debe ser booleano
 *           - datosModificar debe ser "costos", "precios" o "ambos"
 *           - tipoDatoModificar debe ser "cup" o "usd"
 *           - monedaValor debe ser un número mayor que 0
 *       500:
 *         description: Error interno del servidor
 */
router.put('/', authenticate(), configController.updateConfig);

/**
 * @swagger
 * /config/tasa-cambio:
 *   get:
 *     summary: Obtener la tasa de cambio desde el servicio externo
 *     tags: [Configuración]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Respuesta de la API externa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: true
 *       500:
 *         description: Error al consumir la API externa
 */
router.get('/tasa-cambio', authenticate(), configController.getTasaCambio);

/**
 * @swagger
 * /config/audit-logs:
 *   get:
 *     summary: Obtener registros del archivo de auditoría (audit.log)
 *     description: |
 *       Devuelve los registros de auditoría filtrados por usuario, endpoint y rango de fechas,
 *       junto con las sumatorias de tráfico (entrada y salida) en KB, MB y GB.
 *     tags: [Configuración]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: usuario
 *         schema:
 *           type: string
 *         description: |
 *           Filtro por usuario (puede ser ID, nombre o parte de ambos). 
 *           Busca en el campo "Usuario: X (nombre)".
 *       - in: query
 *         name: endpoint
 *         schema:
 *           type: string
 *         description: Filtro parcial por endpoint (ruta y/o método, p.ej. "/servicio").
 *       - in: query
 *         name: fecha_desde
 *         schema:
 *           type: string
 *           format: date-time
 *         description: |
 *           Fecha y hora de inicio (formato ISO: YYYY-MM-DD o YYYY-MM-DD HH:mm:ss).
 *           Si solo se proporciona fecha, se toma desde las 00:00:00.
 *       - in: query
 *         name: fecha_hasta
 *         schema:
 *           type: string
 *           format: date-time
 *         description: |
 *           Fecha y hora de fin (formato ISO: YYYY-MM-DD o YYYY-MM-DD HH:mm:ss).
 *           Si solo se proporciona fecha, se toma hasta las 23:59:59.
 *     responses:
 *       200:
 *         description: Registros filtrados y sumatorias
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 datos:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       timestamp:
 *                         type: string
 *                         example: "2026-09-03 09:10:47"
 *                       usuario:
 *                         type: string
 *                         example: "1 (David Quintana )"
 *                       endpoint:
 *                         type: string
 *                         example: "GET /servicio/filter?limit=10&page=1&fetchProducto=true"
 *                       reqSizeKB:
 *                         type: number
 *                         example: 0.001953125
 *                       resSizeKB:
 *                         type: number
 *                         example: 8.2470703125
 *                 sumatorias:
 *                   type: object
 *                   properties:
 *                     totalReqKB:
 *                       type: number
 *                     totalResKB:
 *                       type: number
 *                     totalReqMB:
 *                       type: number
 *                     totalResMB:
 *                       type: number
 *                     totalReqGB:
 *                       type: number
 *                     totalResGB:
 *                       type: number
 *       400:
 *         description: Parámetros de filtro inválidos
 *       404:
 *         description: Archivo de auditoría no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.get('/audit-logs', authenticate(), configController.getAuditLogs);

/**
 * @swagger
 * /config/audit-logs/summary:
 *   get:
 *     summary: Obtener las sumatorias de tráfico de un usuario por rango de fechas
 *     description: |
 *       Busca el tramo de fechas en audit.log mediante búsqueda binaria y suma el
 *       tamaño de las solicitudes (Req) y respuestas (Res) del usuario indicado.
 *       Ambos extremos del rango son inclusivos. Si se indica la misma fecha para
 *       inicio y fin sin hora, se incluyen todos los registros de ese día.
 *       Las sumas se expresan en KB, MB o GB según su tamaño.
 *     tags: [Configuración]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: id_usuario
 *         required: true
 *         schema:
 *           type: string
 *         description: ID exacto del usuario.
 *       - in: query
 *         name: fecha_desde
 *         required: true
 *         schema:
 *           type: string
 *           example: "2026-09-03"
 *         description: Fecha inicial (YYYY-MM-DD) o fecha y hora (YYYY-MM-DD HH:mm:ss).
 *           El límite es inclusivo; si se omite la hora, comienza a las 00:00:00.
 *       - in: query
 *         name: fecha_hasta
 *         required: true
 *         schema:
 *           type: string
 *           example: "2026-10-15"
 *         description: |
 *           Fecha final inclusiva, con el mismo formato de fecha_desde.
 *           Si se omite la hora, incluye el día hasta las 23:59:59.
 *     responses:
 *       200:
 *         description: Sumatorias de solicitudes y respuestas con su unidad.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id_usuario:
 *                   type: string
 *                 fecha_desde:
 *                   type: string
 *                 fecha_hasta:
 *                   type: string
 *                 sumatorias:
 *                   type: object
 *                   properties:
 *                     totalReq:
 *                       type: object
 *                       properties:
 *                         valor:
 *                           type: number
 *                         unidad:
 *                           type: string
 *                           enum: [KB, MB, GB]
 *                     totalRes:
 *                       type: object
 *                       properties:
 *                         valor:
 *                           type: number
 *                         unidad:
 *                           type: string
 *                           enum: [KB, MB, GB]
 *       400:
 *         description: Parámetros de filtro faltantes o inválidos.
 *       404:
 *         description: Archivo de auditoría no encontrado.
 *       500:
 *         description: Error interno del servidor.
 */
router.get('/audit-logs/summary', authenticate(), configController.getAuditLogSummary);

/**
 * @swagger
 * /config/ping:
 *   get:
 *     summary: Verifica que el servicio esté activo
 *     description: Endpoint de salud que solo retorna un código 200 sin ningún contenido.
 *     tags: [Configuración]
 *     responses:
 *       200:
 *         description: Servicio disponible (sin cuerpo en la respuesta)
 */
router.get('/ping', (req, res) => {
  res.sendStatus(200);
});

module.exports = router;