const express = require("express");
const router = express.Router();
const salidaController = require("../controllers/salidaController");
const authenticate = require("../helpers/authenticate");

/**
 * @swagger
 * tags:
 *   name: Salidas
 *   description: Gestión de salidas de inventario (despacho de productos)
 */

/**
 * @swagger
 * /salida/filter:
 *   get:
 *     summary: Filtrar salidas con paginación
 *     tags: [Salidas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: id_tienda
 *         schema:
 *           type: integer
 *         description: Filtrar por ID de tienda (a través de servicio_tienda)
 *       - in: query
 *         name: id_servicio_tienda
 *         schema:
 *           type: integer
 *         description: Filtrar por ID de servicio-tienda (directo)
 *       - in: query
 *         name: id_usuario
 *         schema:
 *           type: integer
 *         description: Filtrar por usuario que creó la salida
 *       - in: query
 *         name: fecha_desde
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: fecha_hasta
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: tipo_salida
 *         schema:
 *           type: string
 *         description: Tipo de salida (ej. "Venta", "Merma", etc.)
 *       - in: query
 *         name: descripcion
 *         schema:
 *           type: string
 *         description: Buscar por descripción (coincidencia parcial)
 *       - in: query
 *         name: nombre_producto
 *         schema:
 *           type: string
 *         description: Buscar por nombre del servicio asociado a la salida (coincidencia parcial)
 *     responses:
 *       200:
 *         description: Lista de salidas con paginación
 *       400:
 *         description: Parámetros inválidos
 */
router.get("/salida/filter", authenticate(), salidaController.filterSalidas);

/**
 * @swagger
 * /salida/{id}:
 *   get:
 *     summary: Obtener una salida por su ID
 *     tags: [Salidas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Salida encontrada
 *       404:
 *         description: Salida no encontrada
 */
router.get("/salida/:id", authenticate(), salidaController.getSalidaById);

/**
 * @swagger
 * /salida:
 *   post:
 *     summary: Crear una nueva salida (despacho de producto)
 *     tags: [Salidas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id_servicio_tienda
 *               - cantidad_total
 *               - descripcion
 *               - tipo_salida
 *             properties:
 *               id_servicio_tienda:
 *                 type: integer
 *               cantidad_total:
 *                 type: number
 *                 description: Cantidad total a despachar (mayor que 0)
 *               descripcion:
 *                 type: string
 *                 description: Motivo o descripción de la salida
 *               tipo_salida:
 *                 type: string
 *                 description: Tipo de salida (ej. Venta, Merma, Transferencia, etc.)
 *               fecha:
 *                 type: string
 *                 format: date-time
 *                 description: Fecha de la salida (opcional, por defecto ahora)
 *               id_usuario:
 *                 type: integer
 *                 description: ID del usuario que registra. Si no se envía, se toma del token.
 *     responses:
 *       201:
 *         description: Salida creada exitosamente
 *       400:
 *         description: Datos inválidos o stock insuficiente
 *       404:
 *         description: Servicio-tienda no encontrado o no es producto
 */
router.post("/salida", authenticate(), salidaController.createSalida);

/**
 * @swagger
 * /salida/{id}:
 *   put:
 *     summary: Actualizar una salida existente
 *     tags: [Salidas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_servicio_tienda:
 *                 type: integer
 *               cantidad_total:
 *                 type: number
 *               descripcion:
 *                 type: string
 *               tipo_salida:
 *                 type: string
 *               fecha:
 *                 type: string
 *                 format: date-time
 *               id_usuario:
 *                 type: integer
 *             note: |
 *               - La actualización se realiza como una reversión y recreación.
 *               - Todos los campos son opcionales, se actualizarán solo los enviados.
 *               - Si se cambia cantidad_total o servicio_tienda, se reajustan las entradas.
 *     responses:
 *       200:
 *         description: Salida actualizada correctamente
 *       400:
 *         description: Datos inválidos o stock insuficiente
 *       404:
 *         description: Salida no encontrada
 */
router.put("/salida/:id", authenticate(), salidaController.updateSalida);

/**
 * @swagger
 * /salida/{id}:
 *   delete:
 *     summary: Eliminar una salida
 *     tags: [Salidas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Salida eliminada correctamente
 *       400:
 *         description: No se puede eliminar
 *       404:
 *         description: Salida no encontrada
 */
router.delete("/salida/:id", authenticate(), salidaController.deleteSalida);

module.exports = router;