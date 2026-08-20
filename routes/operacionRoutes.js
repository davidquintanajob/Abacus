const express = require("express");
const router = express.Router();
const operacionController = require("../controllers/operacionController");
const authenticate = require("../helpers/authenticate");

/**
 * @swagger
 * tags:
 *   name: Operaciones
 *   description: Gestión de operaciones financieras (movimientos de cuentas)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Operacion:
 *       type: object
 *       properties:
 *         id_operacion:
 *           type: integer
 *         id_cuenta:
 *           type: integer
 *         id_usuario:
 *           type: integer
 *           nullable: true
 *         cantidad_operacion:
 *           type: number
 *           format: double
 *         tipo_operacion:
 *           type: string
 *           enum: [Ingreso, Retiro, Ingreso por Venta]
 *         fecha_hora:
 *           type: string
 *           format: date-time
 *         motivo:
 *           type: string
 *         cambio_moneda:
 *           type: number
 *           format: double
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         cuenta:
 *           $ref: '#/components/schemas/Cuenta'
 *         usuario:
 *           $ref: '#/components/schemas/Usuario'
 */

/**
 * @swagger
 * /operacion/filter:
 *   get:
 *     summary: Filtrar operaciones con paginación y sumatorias
 *     tags: [Operaciones]
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
 *         name: nombre_cuenta
 *         schema:
 *           type: string
 *         description: Búsqueda parcial por nombre de cuenta
 *       - in: query
 *         name: nombre_usuario
 *         schema:
 *           type: string
 *         description: Búsqueda parcial por nombre natural del usuario
 *       - in: query
 *         name: id_tienda
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Filtra por la tienda asociada al usuario de la operación
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
 *         name: cantidad_min
 *         schema:
 *           type: number
 *         description: Monto mínimo (en la moneda de la cuenta)
 *       - in: query
 *         name: cantidad_max
 *         schema:
 *           type: number
 *         description: Monto máximo (en la moneda de la cuenta)
 *     responses:
 *       200:
 *         description: Lista de operaciones con paginación y sumatorias
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Operacion'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalItems:
 *                       type: integer
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalCantidad:
 *                       type: number
 *                       description: Suma de montos en la moneda de cada cuenta
 *                     totalIngresos:
 *                       type: number
 *                     totalRetiros:
 *                       type: number
 *                     totalIngresosVenta:
 *                       type: number
 */
router.get("/operacion/filter", authenticate(), operacionController.filterOperaciones);

/**
 * @swagger
 * /operacion/{id}:
 *   get:
 *     summary: Obtener una operación por ID
 *     tags: [Operaciones]
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
 *         description: Operación encontrada
 *       404:
 *         description: Operación no encontrada
 */
router.get("/operacion/:id", authenticate(), operacionController.getOperacionById);

/**
 * @swagger
 * /operacion:
 *   post:
 *     summary: Crear una nueva operación (actualiza fondo de cuenta)
 *     tags: [Operaciones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id_cuenta
 *               - cantidad_operacion
 *               - tipo_operacion
 *               - motivo
 *               - cambio_moneda
 *             properties:
 *               id_cuenta:
 *                 type: integer
 *               id_usuario:
 *                 type: integer
 *               cantidad_operacion:
 *                 type: number
 *               tipo_operacion:
 *                 type: string
 *                 enum: [Ingreso, Retiro, Ingreso por Venta]
 *               fecha_hora:
 *                 type: string
 *                 format: date-time
 *               motivo:
 *                 type: string
 *               cambio_moneda:
 *                 type: number
 *     responses:
 *       201:
 *         description: Operación creada exitosamente
 *       400:
 *         description: Datos inválidos o fondos insuficientes
 *       404:
 *         description: Cuenta o usuario no encontrado
 */
router.post("/operacion", authenticate(), operacionController.createOperacion);

/**
 * @swagger
 * /operacion/bulk:
 *   post:
 *     summary: Crear múltiples operaciones en lote (transacción)
 *     tags: [Operaciones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - operaciones
 *             properties:
 *               operaciones:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - id_cuenta
 *                     - cantidad_operacion
 *                     - tipo_operacion
 *                     - motivo
 *                     - cambio_moneda
 *                   properties:
 *                     id_cuenta:
 *                       type: integer
 *                     id_usuario:
 *                       type: integer
 *                     cantidad_operacion:
 *                       type: number
 *                     tipo_operacion:
 *                       type: string
 *                       enum: [Ingreso, Retiro, Ingreso por Venta]
 *                     fecha_hora:
 *                       type: string
 *                       format: date-time
 *                     motivo:
 *                       type: string
 *                     cambio_moneda:
 *                       type: number
 *     responses:
 *       201:
 *         description: Operaciones creadas exitosamente
 *       400:
 *         description: Datos inválidos o fondos insuficientes
 */
router.post("/operacion/bulk", authenticate(), operacionController.createOperacionesBulk);

/**
 * @swagger
 * /operacion/{id}:
 *   put:
 *     summary: Actualizar una operación existente (reajusta fondo de cuenta)
 *     tags: [Operaciones]
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
 *               id_cuenta:
 *                 type: integer
 *               id_usuario:
 *                 type: integer
 *               cantidad_operacion:
 *                 type: number
 *               tipo_operacion:
 *                 type: string
 *                 enum: [Ingreso, Retiro, Ingreso por Venta]
 *               fecha_hora:
 *                 type: string
 *                 format: date-time
 *               motivo:
 *                 type: string
 *               cambio_moneda:
 *                 type: number
 *     responses:
 *       200:
 *         description: Operación actualizada correctamente
 *       400:
 *         description: Datos inválidos o fondos insuficientes
 *       404:
 *         description: Operación no encontrada
 */
router.put("/operacion/:id", authenticate(), operacionController.updateOperacion);

/**
 * @swagger
 * /operacion/bulk:
 *   put:
 *     summary: Actualizar múltiples operaciones en lote (transacción)
 *     tags: [Operaciones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - operaciones
 *             properties:
 *               operaciones:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - id_operacion
 *                   properties:
 *                     id_operacion:
 *                       type: integer
 *                     id_cuenta:
 *                       type: integer
 *                     id_usuario:
 *                       type: integer
 *                     cantidad_operacion:
 *                       type: number
 *                     tipo_operacion:
 *                       type: string
 *                       enum: [Ingreso, Retiro, Ingreso por Venta]
 *                     fecha_hora:
 *                       type: string
 *                       format: date-time
 *                     motivo:
 *                       type: string
 *                     cambio_moneda:
 *                       type: number
 *     responses:
 *       200:
 *         description: Operaciones actualizadas correctamente
 *       400:
 *         description: Datos inválidos o fondos insuficientes
 */
router.put("/operacion/bulk", authenticate(), operacionController.updateOperacionesBulk);

/**
 * @swagger
 * /operacion/{id}:
 *   delete:
 *     summary: Eliminar una operación (revierte efecto en fondo de cuenta)
 *     tags: [Operaciones]
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
 *         description: Operación eliminada correctamente
 *       400:
 *         description: No se puede eliminar (por restricciones)
 *       404:
 *         description: Operación no encontrada
 */
router.delete("/operacion/:id", authenticate(), operacionController.deleteOperacion);

module.exports = router;