const express = require("express");
const router = express.Router();
const deudaController = require("../controllers/deudaController");
const authenticate = require("../helpers/authenticate");

/**
 * @swagger
 * tags:
 *   name: Deudas
 *   description: Gestión de deudas de clientes
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     PagoDeuda:
 *       type: object
 *       properties:
 *         id_pago_deuda:
 *           type: integer
 *         fecha_hora:
 *           type: string
 *           format: date-time
 *         cantidad_pagada:
 *           type: number
 *         forma_pago:
 *           type: string
 *           enum: [Efectivo CUP, Transferencia CUP, Efectivo USD, Transferencia USD]
 *         cambio_moneda:
 *           type: number
 *         id_deuda:
 *           type: integer
 *         id_operacion:
 *           type: integer
 *     Deuda:
 *       type: object
 *       properties:
 *         id_deuda:
 *           type: integer
 *         fecha_hora:
 *           type: string
 *           format: date-time
 *         monto_cup:
 *           type: number
 *         monto_usd:
 *           type: number
 *         monto_restante_cup:
 *           type: number
 *         monto_restante_usd:
 *           type: number
 *         cambio_moneda:
 *           type: number
 *         id_cliente:
 *           type: integer
 *         id_lista_venta:
 *           type: integer
 *           nullable: true
 *         cliente:
 *           type: object
 *         pagos:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PagoDeuda'
 *         listaVenta:
 *           type: object
 *           nullable: true
 */

/**
 * @swagger
 * /deuda/filter:
 *   get:
 *     summary: Filtrar deudas con paginación
 *     tags: [Deudas]
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
 *         name: id_cliente
 *         schema:
 *           type: integer
 *       - in: query
 *         name: nombre_cliente
 *         schema:
 *           type: string
 *       - in: query
 *         name: telefono_cliente
 *         schema:
 *           type: string
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
 *         name: monto_cup_min
 *         schema:
 *           type: number
 *       - in: query
 *         name: monto_cup_max
 *         schema:
 *           type: number
 *       - in: query
 *         name: monto_usd_min
 *         schema:
 *           type: number
 *       - in: query
 *         name: monto_usd_max
 *         schema:
 *           type: number
 *       - in: query
 *         name: tiene_deuda
 *         schema:
 *           type: boolean
 *         description: Si es true, devuelve solo deudas no saldadas. Si es false, devuelve solo las saldadas.
 *     responses:
 *       200:
 *         description: Lista de deudas con paginación
 */
router.get("/deuda/filter", authenticate(), deudaController.filterDeudas);

/**
 * @swagger
 * /deuda/{id}:
 *   get:
 *     summary: Obtener una deuda por ID (incluye cliente, pagos y lista_venta)
 *     tags: [Deudas]
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
 *         description: Deuda encontrada
 *       404:
 *         description: Deuda no encontrada
 */
router.get("/deuda/:id", authenticate(), deudaController.getDeudaById);

/**
 * @swagger
 * /deuda:
 *   post:
 *     summary: Crear una nueva deuda (opcionalmente con un pago inicial)
 *     tags: [Deudas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id_cliente
 *               - monto_cup
 *               - monto_usd
 *               - cambio_moneda
 *             properties:
 *               fecha_hora:
 *                 type: string
 *                 format: date-time
 *               monto_cup:
 *                 type: number
 *               monto_usd:
 *                 type: number
 *               cambio_moneda:
 *                 type: number
 *               id_cliente:
 *                 type: integer
 *               id_lista_venta:
 *                 type: integer
 *                 nullable: true
 *               pago_deuda:
 *                 type: object
 *                 properties:
 *                   id_usuario:
 *                     type: integer
 *                   fecha_hora:
 *                     type: string
 *                     format: date-time
 *                   cantidad_pagada:
 *                     type: number
 *                   forma_pago:
 *                     type: string
 *                     enum: [Efectivo CUP, Transferencia CUP, Efectivo USD, Transferencia USD]
 *                   cambio_moneda:
 *                     type: number
 *                   id_cuenta_operacion:
 *                     type: integer
 *     responses:
 *       201:
 *         description: Deuda creada exitosamente
 */
router.post("/deuda", authenticate(), deudaController.createDeuda);

/**
 * @swagger
 * /deuda/{id}:
 *   put:
 *     summary: Actualizar una deuda existente y su lista de pagos
 *     tags: [Deudas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     description: |
 *       **Lógica de la transacción:**
 *       - Si se envía `pagos`, **se reemplaza toda la lista de pagos** de la deuda:
 *         - Se revierten los pagos anteriores (se resta del fondo de cada cuenta la cantidad pagada, siguiendo la lógica individual de la operación). Se valida primero que ninguna cuenta quede con saldo negativo.
 *         - Se eliminan los `pago_deuda` y sus `operacion` asociadas.
 *         - Se recalculan `monto_restante_cup` y `monto_restante_usd` reiniciándolos a los nuevos `monto_cup` y `monto_usd`.
 *         - Se crean los nuevos pagos aplicando la lógica normal (crea `operacion`, `pago_deuda`, resta del monto restante y suma al fondo de la cuenta).
 *       - Si **no** se envía `pagos`, se actualizan solo los campos de la deuda y se recalcula `monto_restante_*` en base a los pagos existentes y los nuevos montos (validando que no quede negativo).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fecha_hora:
 *                 type: string
 *                 format: date-time
 *               monto_cup:
 *                 type: number
 *               monto_usd:
 *                 type: number
 *               cambio_moneda:
 *                 type: number
 *               id_cliente:
 *                 type: integer
 *               id_lista_venta:
 *                 type: integer
 *                 nullable: true
 *               pagos:
 *                 type: array
 *                 description: Si se envía, se reemplaza toda la lista de pagos. Si no, se mantienen los pagos existentes.
 *                 items:
 *                   type: object
 *                   required:
 *                     - cantidad_pagada
 *                     - forma_pago
 *                     - id_cuenta_operacion
 *                   properties:
 *                     id_usuario:
 *                       type: integer
 *                     fecha_hora:
 *                       type: string
 *                       format: date-time
 *                     cantidad_pagada:
 *                       type: number
 *                     forma_pago:
 *                       type: string
 *                       enum: [Efectivo CUP, Transferencia CUP, Efectivo USD, Transferencia USD]
 *                     cambio_moneda:
 *                       type: number
 *                     id_cuenta_operacion:
 *                       type: integer
 *     responses:
 *       200:
 *         description: Deuda actualizada correctamente
 *       400:
 *         description: Datos inválidos o fondos insuficientes
 *       404:
 *         description: Deuda no encontrada
 */
router.put("/deuda/:id", authenticate(), deudaController.updateDeuda);

/**
 * @swagger
 * /deuda/{id}/saldar:
 *   post:
 *     summary: Registrar uno o más pagos para saldar una deuda existente
 *     tags: [Deudas]
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
 *             required:
 *               - pagos
 *             properties:
 *               pagos:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - cantidad_pagada
 *                     - forma_pago
 *                     - id_cuenta_operacion
 *                   properties:
 *                     id_usuario:
 *                       type: integer
 *                     fecha_hora:
 *                       type: string
 *                       format: date-time
 *                     cantidad_pagada:
 *                       type: number
 *                     forma_pago:
 *                       type: string
 *                       enum: [Efectivo CUP, Transferencia CUP, Efectivo USD, Transferencia USD]
 *                     cambio_moneda:
 *                       type: number
 *                     id_cuenta_operacion:
 *                       type: integer
 *     responses:
 *       200:
 *         description: Pagos registrados correctamente
 *       400:
 *         description: Datos inválidos o monto excedido
 *       404:
 *         description: Deuda no encontrada
 */
router.post("/deuda/:id/saldar", authenticate(), deudaController.saldarDeuda);

/**
 * @swagger
 * /deuda/{id}:
 *   delete:
 *     summary: Eliminar una deuda con todos sus pagos y operaciones asociadas (en cascada)
 *     tags: [Deudas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     description: |
 *       **Lógica de la transacción:**
 *       - Se elimina la deuda aunque tenga pagos o no esté saldada.
 *       - Por cada `pago_deuda`:
 *         - Se revierte su `operacion` asociada, restando del fondo de la cuenta la cantidad pagada (validando primero que ninguna cuenta quede con saldo negativo).
 *         - Se elimina el `pago_deuda` y luego la `operacion`.
 *       - Finalmente se elimina la deuda.
 *       - Todo dentro de una transacción.
 *     responses:
 *       200:
 *         description: Deuda eliminada correctamente
 *       400:
 *         description: No se puede eliminar porque alguna cuenta quedaría con saldo negativo al revertir los pagos
 *       404:
 *         description: Deuda no encontrada
 */
router.delete("/deuda/:id", authenticate(), deudaController.deleteDeuda);

module.exports = router;