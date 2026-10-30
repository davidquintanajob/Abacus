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
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: id_servicio_tienda
 *         schema:
 *           type: integer
 *       - in: query
 *         name: id_usuario
 *         schema:
 *           type: integer
 *       - in: query
 *         name: fecha_desde
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de creación inicial (YYYY-MM-DD)
 *       - in: query
 *         name: fecha_hasta
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de creación final (YYYY-MM-DD)
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
 *       - in: query
 *         name: cantidad_restante_min
 *         schema:
 *           type: number
 *         description: Cantidad restante mínima (incluye)
 *       - in: query
 *         name: cantidad_restante_max
 *         schema:
 *           type: number
 *         description: Cantidad restante máxima (incluye)
 *       - in: query
 *         name: fecha_vencimiento_desde
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de vencimiento mínima (YYYY-MM-DD) – solo entradas con fecha >=
 *       - in: query
 *         name: fecha_vencimiento_hasta
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de vencimiento máxima (YYYY-MM-DD) – solo entradas con fecha <=
 *     responses:
 *       200:
 *          description: Lista paginada de entradas con su lista fabricaciones
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
 *          description: Entrada encontrada con su lista fabricaciones
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
 *          description: Entrada creada exitosamente con su lista fabricaciones
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
 * /entrada/fabricacion:
 *   post:
 *     summary: Crear una entrada con sus insumos de fabricación
 *     tags: [Entradas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id_servicio_tienda, cantidad_entrada, costo_usd, costo_cup, fabricaciones]
 *             properties:
 *               id_servicio_tienda:
 *                 type: integer
 *               cantidad_entrada:
 *                 type: number
 *               costo_usd:
 *                 type: number
 *               costo_cup:
 *                 type: number
 *               fecha_vencimiento:
 *                 type: string
 *                 format: date
 *               nombre_proveedor:
 *                 type: string
 *               id_usuario:
 *                 type: integer
 *               fecha:
 *                 type: string
 *                 format: date-time
 *               fabricaciones:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [id_servicio_tienda, cantidad_insumo, costo_insumo_cup, costo_insumo_usd]
 *                   properties:
 *                     id_servicio_tienda:
 *                       type: integer
 *                     cantidad_insumo:
 *                       type: number
 *                     costo_insumo_cup:
 *                       type: number
 *                     costo_insumo_usd:
 *                       type: number
 *     responses:
 *       201:
 *         description: Entrada y fabricaciones creadas; el inventario de insumos fue actualizado
 *       400:
 *         description: Datos inválidos o cantidad de insumos superior al inventario disponible
 *       404:
 *         description: Servicio-tienda no encontrado
 */
router.post(
  "/entrada/fabricacion",
  authenticate(),
  entradaController.createEntradaWithFabricaciones
);

/**
 * @swagger
 * /entrada/bulk:
 *   post:
 *     summary: Crear múltiples entradas en lote
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
 *               - entradas
 *             properties:
 *               entradas:
 *                 type: array
 *                 description: Lista de entradas a crear
 *                 items:
 *                   type: object
 *                   required:
 *                     - id_servicio_tienda
 *                     - cantidad_entrada
 *                     - costo_usd
 *                     - costo_cup
 *                   properties:
 *                     id_servicio_tienda:
 *                       type: integer
 *                     cantidad_entrada:
 *                       type: number
 *                     costo_usd:
 *                       type: number
 *                     costo_cup:
 *                       type: number
 *                     fecha_vencimiento:
 *                       type: string
 *                       format: date
 *                     nombre_proveedor:
 *                       type: string
 *                     id_usuario:
 *                       type: integer
 *                       description: Si no se envía, se toma del token (aplica a todas las entradas)
 *                     fecha:
 *                       type: string
 *                       format: date-time
 *                       description: Si no se envía, se usa la fecha actual (aplica a todas)
 *     responses:
 *       201:
 *          description: Entradas creadas exitosamente con sus listas fabricaciones
 *       400:
 *         description: Datos inválidos
 *       500:
 *         description: Error interno del servidor
 */
router.post("/entrada/bulk", authenticate(), entradaController.createEntradasBulk);

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
 *                 description: Nueva cantidad total (debe ser mayor que 0 y no menor que lo ya consumido)
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
 *               - Si se cambia la cantidad_entrada, la cantidad restante se ajusta conservando las cantidades ya consumidas.
 *               - Si se cambia el id_servicio_tienda, solo la cantidad restante de la entrada se mueve entre tiendas; los movimientos ya creados se conservan.
 *               - Al eliminar, solo se descuenta del inventario la cantidad restante de la entrada.
 *               - Si el nuevo producto es vencible, la fecha_vencimiento es obligatoria.
 *     responses:
 *       200:
 *          description: Entrada actualizada correctamente con su lista fabricaciones
 *       400:
 *         description: Datos inválidos
 *       404:
 *         description: Entrada no encontrada
 */
router.put("/entrada/:id", authenticate(), entradaController.updateEntrada);

/**
 * @swagger
 * /entrada/fabricacion/{id}:
 *   put:
 *     summary: Actualizar una entrada y reemplazar sus insumos de fabricación
 *     tags: [Entradas]
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
 *             required: [fabricaciones]
 *             properties:
 *               id_servicio_tienda:
 *                 type: integer
 *               cantidad_entrada:
 *                 type: number
 *               costo_usd:
 *                 type: number
 *               costo_cup:
 *                 type: number
 *               fecha_vencimiento:
 *                 type: string
 *                 format: date
 *               nombre_proveedor:
 *                 type: string
 *               id_usuario:
 *                 type: integer
 *               fecha:
 *                 type: string
 *                 format: date-time
 *               fabricaciones:
 *                 type: array
 *                 description: Lista completa de fabricaciones; enviar [] para eliminar todas
 *                 items:
 *                   type: object
 *                   required: [id_servicio_tienda, cantidad_insumo, costo_insumo_cup, costo_insumo_usd]
 *                   properties:
 *                     id_servicio_tienda:
 *                       type: integer
 *                     cantidad_insumo:
 *                       type: number
 *                     costo_insumo_cup:
 *                       type: number
 *                     costo_insumo_usd:
 *                       type: number
 *     responses:
 *       200:
 *         description: Entrada y fabricaciones actualizadas; inventarios ajustados
 *       400:
 *         description: Datos inválidos o el ajuste dejaría inventario negativo
 *       404:
 *         description: Entrada o servicio-tienda no encontrado
 */
router.put(
  "/entrada/fabricacion/:id",
  authenticate(),
  entradaController.updateEntradaWithFabricaciones
);

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