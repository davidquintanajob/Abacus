const express = require("express");
const router = express.Router();
const clienteController = require("../controllers/clienteController");
const authenticate = require("../helpers/authenticate");

/**
 * @swagger
 * tags:
 *   name: Clientes
 *   description: Gestión de clientes
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
 *         pagos:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PagoDeuda'
 *     Cliente:
 *       type: object
 *       properties:
 *         id_cliente:
 *           type: integer
 *         nombre:
 *           type: string
 *         nota:
 *           type: string
 *           nullable: true
 *         direccion:
 *           type: string
 *           nullable: true
 *         telefono:
 *           type: string
 *           nullable: true
 *         localizacion_coordenadas_gps:
 *           type: string
 *           nullable: true
 *         tipo_cliente:
 *           type: string
 *           nullable: true
 *         descuento:
 *           type: string
 *           nullable: true
 *         deudas:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Deuda'
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /cliente/filter:
 *   get:
 *     summary: Filtrar clientes con paginación
 *     tags: [Clientes]
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
 *         name: nombre
 *         schema:
 *           type: string
 *       - in: query
 *         name: telefono
 *         schema:
 *           type: string
 *       - in: query
 *         name: direccion
 *         schema:
 *           type: string
 *         description: Filtro parcial por dirección
 *       - in: query
 *         name: tipo_cliente
 *         schema:
 *           type: string
 *         description: Filtro parcial por tipo de cliente
 *       - in: query
 *         name: tiene_deuda
 *         schema:
 *           type: boolean
 *         description: Si es true, devuelve solo clientes con al menos una deuda cuyo monto_restante_cup o monto_restante_usd sea distinto de 0. Si es false, devuelve solo clientes sin deudas pendientes.
 *     responses:
 *       200:
 *         description: Lista de clientes con paginación (incluye deudas con sus pagos y operaciones)
 */
router.get("/cliente/filter", authenticate(), clienteController.filterClientes);

/**
 * @swagger
 * /cliente/{id}:
 *   get:
 *     summary: Obtener un cliente por ID (incluye deudas, pagos y operaciones)
 *     tags: [Clientes]
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
 *         description: Cliente encontrado
 *       404:
 *         description: Cliente no encontrado
 */
router.get("/cliente/:id", authenticate(), clienteController.getClienteById);

/**
 * @swagger
 * /cliente:
 *   post:
 *     summary: Crear un nuevo cliente (opcionalmente con deuda y pago inicial)
 *     tags: [Clientes]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Lógica de la transacción:**
 *       - Se crea el cliente con los datos del nivel raíz.
 *       - Si se envía el objeto `deuda`, se crea una `deuda`:
 *         - `monto_restante_cup` y `monto_restante_usd` se inicializan iguales a `monto_cup` y `monto_usd`.
 *       - Si se envía el objeto `pago_deuda` (junto con `deuda`), se registra un pago inicial:
 *         - Se crea una **`operacion`** de tipo **"Pago de deuda"** con:
 *           - `id_usuario` (recibido en `pago_deuda.id_usuario`, o del token si no se envía)
 *           - `id_cuenta = id_cuenta_operacion`
 *           - `cantidad_operacion = cantidad_pagada`
 *           - `motivo = "Pago de deuda del cliente (<nombre>)"`
 *         - Se crea un **`pago_deuda`** asociado tanto a la `deuda` como a la `operacion`.
 *         - Se resta `cantidad_pagada` del `monto_restante_cup` (si la forma de pago es CUP) o del `monto_restante_usd` (si es USD).
 *         - Se actualiza el `fondo` de la cuenta sumando la cantidad pagada.
 *       - Todo dentro de una transacción.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *             properties:
 *               nombre:
 *                 type: string
 *               nota:
 *                 type: string
 *               direccion:
 *                 type: string
 *               telefono:
 *                 type: string
 *               localizacion_coordenadas_gps:
 *                 type: string
 *               tipo_cliente:
 *                 type: string
 *               descuento:
 *                 type: string
 *               deuda:
 *                 type: object
 *                 description: Datos opcionales para crear una deuda inicial junto con el cliente
 *                 properties:
 *                   fecha_hora:
 *                     type: string
 *                     format: date-time
 *                   monto_cup:
 *                     type: number
 *                   monto_usd:
 *                     type: number
 *                   cambio_moneda:
 *                     type: number
 *                   id_lista_venta:
 *                     type: integer
 *               pago_deuda:
 *                 type: object
 *                 description: Datos opcionales para registrar un pago inicial sobre la deuda recién creada. Solo válido si se envía `deuda`.
 *                 properties:
 *                   id_usuario:
 *                     type: integer
 *                     description: ID del usuario que registra el pago (opcional; si no se envía, se toma del token).
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
 *         description: Cliente creado exitosamente
 *       400:
 *         description: Datos inválidos
 */
router.post("/cliente", authenticate(), clienteController.createCliente);

/**
 * @swagger
 * /cliente/{id}:
 *   put:
 *     summary: Actualizar datos propios de un cliente
 *     tags: [Clientes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     description: |
 *       **Este endpoint solo actualiza los datos propios del cliente.**
 *       No interactúa con deudas ni pagos de deuda.
 *       Para registrar pagos o crear deudas, use los endpoints correspondientes.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               nota:
 *                 type: string
 *               direccion:
 *                 type: string
 *               telefono:
 *                 type: string
 *               localizacion_coordenadas_gps:
 *                 type: string
 *               tipo_cliente:
 *                 type: string
 *               descuento:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cliente actualizado
 *       404:
 *         description: Cliente no encontrado
 */
router.put("/cliente/:id", authenticate(), clienteController.updateCliente);

/**
 * @swagger
 * /cliente/{id}:
 *   delete:
 *     summary: Eliminar un cliente
 *     tags: [Clientes]
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
 *         description: Cliente eliminado
 *       404:
 *         description: Cliente no encontrado
 */
router.delete("/cliente/:id", authenticate(), clienteController.deleteCliente);

module.exports = router;