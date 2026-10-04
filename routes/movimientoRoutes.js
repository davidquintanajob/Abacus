const express = require("express");
const router = express.Router();
const movimientoController = require("../controllers/movimientoController");
const authenticate = require("../helpers/authenticate");

/**
 * @swagger
 * tags:
 *   name: Movimientos
 *   description: Gestión de movimientos de inventario entre tiendas
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     MovimientoLista:
 *       type: object
 *       properties:
 *         id_movimiento_lista:
 *           type: integer
 *         fecha_hora:
 *           type: string
 *           format: date-time
 *         tipo_movimiento:
 *           type: string
 *         estado:
 *           type: boolean
 *         nota:
 *           type: string
 *           nullable: true
 *         id_usuario:
 *           type: integer
 *         usuario:
 *           type: object
 *         movimientos:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id_movimiento:
 *                 type: integer
 *               cantidad:
 *                 type: number
 *               nota:
 *                 type: string
 *               servicioTiendaOrigen:
 *                 type: object
 *               servicioTiendaDestino:
 *                 type: object
 *               movimientoEntradas:
 *                 type: array
 *                 items:
 *                   type: object
 */

/**
 * @swagger
 * /movimiento/filter:
 *   get:
 *     summary: Filtrar movimientos con paginación
 *     description: Si se envían id_servicio_tienda_origen e id_servicio_tienda_destino, se buscan movimientos que coincidan con el origen o el destino; los demás filtros se mantienen como condiciones adicionales.
 *     tags: [Movimientos]
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
 *         name: id_usuario
 *         schema:
 *           type: integer
 *       - in: query
 *         name: tipo_movimiento
 *         schema:
 *           type: string
 *       - in: query
 *         name: estado
 *         schema:
 *           type: boolean
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
 *         name: id_servicio_tienda_origen
 *         schema:
 *           type: integer
 *       - in: query
 *         name: id_servicio_tienda_destino
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de movimientos con paginación
 */
router.get("/movimiento/filter", authenticate(), movimientoController.filterMovimientos);

/**
 * @swagger
 * /movimiento/{id}:
 *   get:
 *     summary: Obtener un movimiento por ID con todas sus relaciones
 *     tags: [Movimientos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la lista de movimientos (id_movimiento_lista)
 *     responses:
 *       200:
 *         description: Movimiento encontrado
 *       404:
 *         description: No encontrado
 */
router.get("/movimiento/:id", authenticate(), movimientoController.getMovimientoById);

/**
 * @swagger
 * /movimiento:
 *   post:
 *     summary: Crear un movimiento (transferencia entre tiendas) con transacción
 *     tags: [Movimientos]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Lógica del endpoint (transacción)**
 *
 *       **1. Datos esperados:**
 *       - Datos de la lista: `id_usuario`, `fecha_hora`, `tipo_movimiento`, `estado`, `nota` (opcional).
 *       - `id_servicio_tienda_origen` e `id_servicio_tienda_destino` se reciben **una sola vez a nivel raíz** y se aplican a todos los items del arreglo `movimientos` (ya que normalmente el origen y el destino no cambian entre movimientos de la misma lista).
 *       - Lista `movimientos`: cada item debe tener `cantidad` y opcionalmente `nota`. Los IDs de origen/destino se toman del nivel raíz.
 *
 *       **2. Validaciones:**
 *       - El usuario debe existir.
 *       - El origen y el destino deben existir y estar asociados a un producto (herencia Servicio → Producto).
 *       - Origen y destino deben corresponder al **mismo producto** (mismo `id_servicio`).
 *       - Origen y destino no pueden ser el mismo `id_servicio_tienda`.
 *       - Cada `cantidad` debe ser mayor que cero.
 *       - Si `estado` es `true`, el origen debe tener stock suficiente para cada movimiento.
 *
 *       **3. Comportamiento según `estado`:**
 *       - **`estado = true`**: se aplica toda la lógica (descuento de entradas, resta del origen, suma al destino).
 *       - **`estado = false`**: solo se crean los registros sin modificar inventario.
 *
 *       **4. Respuesta:** Lista de movimientos con todas las relaciones.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id_usuario
 *               - tipo_movimiento
 *               - id_servicio_tienda_origen
 *               - id_servicio_tienda_destino
 *               - movimientos
 *             properties:
 *               id_usuario:
 *                 type: integer
 *               fecha_hora:
 *                 type: string
 *                 format: date-time
 *               tipo_movimiento:
 *                 type: string
 *               estado:
 *                 type: boolean
 *                 default: true
 *               nota:
 *                 type: string
 *                 description: Nota general de la lista de movimientos
 *               id_servicio_tienda_origen:
 *                 type: integer
 *                 description: ID del servicio-tienda de origen. Se aplica a todos los items de `movimientos`.
 *               id_servicio_tienda_destino:
 *                 type: integer
 *                 description: ID del servicio-tienda de destino. Se aplica a todos los items de `movimientos`.
 *               movimientos:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - cantidad
 *                   properties:
 *                     cantidad:
 *                       type: number
 *                       description: Cantidad a mover en este item. Debe ser mayor que cero.
 *                     nota:
 *                       type: string
 *                       description: Nota opcional por item de movimiento
 *     responses:
 *       201:
 *         description: Movimiento creado exitosamente
 *       400:
 *         description: Datos inválidos o stock insuficiente
 *       404:
 *         description: Recurso no encontrado
 */
router.post("/movimiento", authenticate(), movimientoController.createMovimiento);

/**
 * @swagger
 * /movimiento/{id}:
 *   put:
 *     summary: Actualizar un movimiento existente (revierte y re-aplica)
 *     tags: [Movimientos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la lista de movimientos (id_movimiento_lista)
 *     description: |
 *       **Lógica de actualización:**
 *       - Si el `estado` anterior era `true`, se revierten todos los efectos (stock y entradas) antes de aplicar los nuevos.
 *       - Luego se aplican los nuevos datos respetando la lógica del `estado`.
 *       - El `id_servicio_tienda_origen` e `id_servicio_tienda_destino` se reciben **una sola vez a nivel raíz** y se aplican a todos los items del arreglo `movimientos`.
 *       - Todo dentro de una transacción.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id_usuario
 *               - tipo_movimiento
 *               - id_servicio_tienda_origen
 *               - id_servicio_tienda_destino
 *               - movimientos
 *             properties:
 *               id_usuario:
 *                 type: integer
 *               fecha_hora:
 *                 type: string
 *                 format: date-time
 *               tipo_movimiento:
 *                 type: string
 *               estado:
 *                 type: boolean
 *               nota:
 *                 type: string
 *               id_servicio_tienda_origen:
 *                 type: integer
 *                 description: ID del servicio-tienda de origen. Se aplica a todos los items de `movimientos`.
 *               id_servicio_tienda_destino:
 *                 type: integer
 *                 description: ID del servicio-tienda de destino. Se aplica a todos los items de `movimientos`.
 *               movimientos:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - cantidad
 *                   properties:
 *                     cantidad:
 *                       type: number
 *                     nota:
 *                       type: string
 *     responses:
 *       200:
 *         description: Movimiento actualizado correctamente
 *       400:
 *         description: Datos inválidos o stock insuficiente
 *       404:
 *         description: Movimiento no encontrado
 */
router.put("/movimiento/:id", authenticate(), movimientoController.updateMovimiento);

/**
 * @swagger
 * /movimiento/{id}:
 *   delete:
 *     summary: Eliminar un movimiento (revierte todos los efectos)
 *     tags: [Movimientos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la lista de movimientos (id_movimiento_lista)
 *     description: |
 *       **Lógica de eliminación:**
 *       - Si el `estado` era `true`, se revierten todos los efectos.
 *       - Si el `estado` era `false`, solo se eliminan los registros sin afectar inventario.
 *       - Todo dentro de una transacción.
 *     responses:
 *       200:
 *         description: Movimiento eliminado correctamente
 *       400:
 *         description: No se puede revertir por falta de stock en destino
 *       404:
 *         description: Movimiento no encontrado
 */
router.delete("/movimiento/:id", authenticate(), movimientoController.deleteMovimiento);

module.exports = router;