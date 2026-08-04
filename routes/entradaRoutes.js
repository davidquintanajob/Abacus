const express = require("express");
const router = express.Router();
const entradaController = require("../controllers/entradaController");
const authenticate = require("../helpers/authenticate");

/**
 * @swagger
 * tags:
 *   name: Entradas
 *   description: Gestión de entradas de productos
 */

/**
 * @swagger
 * /entrada/filter:
 *   get:
 *     summary: Filtrar entradas con paginación
 *     tags: [Entradas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Cantidad de registros por página
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: id_servicio_tienda
 *         schema:
 *           type: integer
 *         description: Filtrar por ID de relación servicio-tienda
 *       - in: query
 *         name: id_usuario
 *         schema:
 *           type: integer
 *         description: Filtrar por ID de usuario que creó la entrada
 *       - in: query
 *         name: fecha_desde
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha inicial (YYYY-MM-DD)
 *       - in: query
 *         name: fecha_hasta
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha final (YYYY-MM-DD)
 *       - in: query
 *         name: nombre_servicio
 *         schema:
 *           type: string
 *         description: Buscar por nombre del servicio (producto)
 *       - in: query
 *         name: codigo_lote
 *         schema:
 *           type: string
 *         description: Buscar por código de lote (coincidencia parcial)
 *       - in: query
 *         name: id_tienda
 *         schema:
 *           type: integer
 *         description: Filtrar por ID de tienda (relacionada a través de servicio_tienda)
 *       - in: query
 *         name: id_servicio
 *         schema:
 *           type: integer
 *         description: Filtrar por ID de servicio (relacionado a través de servicio_tienda)
 *     responses:
 *       200:
 *         description: Lista de entradas con paginación
 *       400:
 *         description: Parámetros inválidos
 *       500:
 *         description: Error interno del servidor
 */
router.get("/entrada/filter", authenticate(), entradaController.filterEntradas);
/**
 * @swagger
 * /entrada/{id}:
 *   get:
 *     summary: Obtener una entrada por su ID
 *     tags: [Entradas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la entrada
 *     responses:
 *       200:
 *         description: Entrada encontrada
 *       404:
 *         description: Entrada no encontrada
 */
router.get("/entrada/:id", authenticate(), entradaController.getEntradaById);

/**
 * @swagger
 * /entrada:
 *   post:
 *     summary: Crear una nueva entrada
 *     tags: [Entradas]
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
 *               - cantidad_entrada
 *               - costo_usd
 *               - costo_cup
 *             properties:
 *               id_servicio_tienda:
 *                 type: integer
 *                 description: ID de la relación servicio-tienda (obligatorio)
 *               cantidad_entrada:
 *                 type: number
 *                 description: Cantidad que ingresa (mayor que 0)
 *               costo_usd:
 *                 type: number
 *                 description: Costo en USD (con 5 decimales)
 *               costo_cup:
 *                 type: number
 *                 description: Costo en CUP (con 5 decimales)
 *               fecha_vencimiento:
 *                 type: string
 *                 format: date
 *                 description: Fecha de vencimiento (obligatoria si el producto es vencible)
 *               nombre_proveedor:
 *                 type: string
 *                 description: Nombre del proveedor (opcional)
 *               id_usuario:
 *                 type: integer
 *                 description: ID del usuario que registra la entrada. Si no se envía, se toma del token.
 *               fecha:
 *                 type: string
 *                 format: date-time
 *                 description: Fecha y hora de la entrada. Si no se envía, se usa la fecha actual.
 *     responses:
 *       201:
 *         description: Entrada creada exitosamente
 *       400:
 *         description: Datos inválidos (incluye validaciones de negocio)
 *       404:
 *         description: Servicio-tienda no encontrado o no es producto
 *       500:
 *         description: Error interno del servidor
 */
router.post("/entrada", authenticate(), entradaController.createEntrada);

/**
 * @swagger
 * /entrada/{id}:
 *   put:
 *     summary: Actualizar una entrada existente
 *     tags: [Entradas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la entrada
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_servicio_tienda:
 *                 type: integer
 *                 description: Nuevo ID de relación servicio-tienda (opcional). Si se cambia, la cantidad se ajusta automáticamente entre la tienda origen y destino.
 *               cantidad_entrada:
 *                 type: number
 *                 description: Nueva cantidad (debe ser mayor que 0)
 *               costo_usd:
 *                 type: number
 *                 description: Costo en USD (con 5 decimales)
 *               costo_cup:
 *                 type: number
 *                 description: Costo en CUP (con 5 decimales)
 *               fecha_vencimiento:
 *                 type: string
 *                 format: date
 *                 description: Fecha de vencimiento (obligatoria si el producto es vencible)
 *               nombre_proveedor:
 *                 type: string
 *                 description: Nombre del proveedor
 *               id_usuario:
 *                 type: integer
 *                 description: ID del usuario que registra la entrada (opcional, para corregir)
 *               fecha:
 *                 type: string
 *                 format: date-time
 *                 description: Nueva fecha y hora de la entrada (opcional)
 *             note: |
 *               - No se puede modificar el código de lote ni la cantidad restante.
 *               - Si se cambia la cantidad_entrada, la cantidad restante se ajusta automáticamente.
 *               - Si se cambia el id_servicio_tienda, la cantidad se resta de la tienda origen y se suma a la tienda destino.
 *               - Si el nuevo producto es vencible, la fecha_vencimiento es obligatoria.
 *     responses:
 *       200:
 *         description: Entrada actualizada correctamente
 *       400:
 *         description: Datos inválidos
 *       404:
 *         description: Entrada no encontrada
 */
router.put("/entrada/:id", authenticate(), entradaController.updateEntrada);

/**
 * @swagger
 * /entrada/{id}:
 *   delete:
 *     summary: Eliminar una entrada
 *     tags: [Entradas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la entrada
 *     responses:
 *       200:
 *         description: Entrada eliminada correctamente
 *       400:
 *         description: No se puede eliminar porque dejaría cantidad negativa en el inventario
 *       404:
 *         description: Entrada no encontrada
 */
router.delete("/entrada/:id", authenticate(), entradaController.deleteEntrada);

module.exports = router;