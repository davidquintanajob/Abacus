const express = require("express");
const router = express.Router();
const listaVentaController = require("../controllers/listaVentaController");
const authenticate = require("../helpers/authenticate");

/**
 * @swagger
 * tags:
 *   name: ListaVenta
 *   description: Gestión de listas de ventas (facturas/boletas)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ListaVenta:
 *       type: object
 *       properties:
 *         id_lista_venta:
 *           type: integer
 *         fecha_hora:
 *           type: string
 *           format: date-time
 *         nota:
 *           type: string
 *           nullable: true
 *         cantidad_cobrada_efectivo_cup:
 *           type: number
 *         cantidad_cobrada_efectivo_usd:
 *           type: number
 *         cantidad_cobrada_transferencia_cup:
 *           type: number
 *         cantidad_cobrada_transferencia_usd:
 *           type: number
 *         ventas:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Venta'
 *         operaciones:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Operacion'
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /lista-venta/filter:
 *   get:
 *     summary: Filtrar listas de ventas con paginación y sumatorias
 *     tags: [ListaVenta]
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
 *         name: nota
 *         schema:
 *           type: string
 *       - in: query
 *         name: cantidad_min
 *         schema:
 *           type: number
 *         description: Monto mínimo cobrado (suma de todas las formas de cobro)
 *       - in: query
 *         name: cantidad_max
 *         schema:
 *           type: number
 *         description: Monto máximo cobrado (suma de todas las formas de cobro)
 *       - in: query
 *         name: forma_cobro
 *         schema:
 *           type: string
 *           enum: [Efectivo CUP, Efectivo USD, Transferencia CUP, Transferencia USD]
 *         description: Filtra por aquellas listas con cantidad > 0 en esa forma de cobro
 *       - in: query
 *         name: nombre_usuario
 *         schema:
 *           type: string
 *         description: Filtra por nombre de usuario asociado a las operaciones de la lista
 *     responses:
 *       200:
 *         description: Lista de listas de ventas con paginación y sumatorias
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ListaVenta'
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
 *                     total_efectivo_cup:
 *                       type: number
 *                     total_efectivo_usd:
 *                       type: number
 *                     total_transferencia_cup:
 *                       type: number
 *                     total_transferencia_usd:
 *                       type: number
 */
router.get("/lista-venta/filter", authenticate(), listaVentaController.filterListaVentas);

/**
 * @swagger
 * /lista-venta/{id}:
 *   get:
 *     summary: Obtener una lista de ventas por ID con todas sus relaciones
 *     tags: [ListaVenta]
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
 *         description: Lista de ventas encontrada
 *       404:
 *         description: No encontrada
 */
router.get("/lista-venta/:id", authenticate(), listaVentaController.getListaVentaById);

/**
 * @swagger
 * /lista-venta:
 *   post:
 *     summary: Crear una lista de ventas con sus ventas y operaciones (transacción)
 *     tags: [ListaVenta]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **Lógica del endpoint (transacción)**
 *
 *       **1. Validaciones iniciales:**
 *       - Se valida que `ventas` sea un arreglo no vacío.
 *       - Se valida que `id_usuario` y `cambio_moneda` estén presentes y sean válidos.
 *       - Se verifica que los montos cobrados no sean negativos.
 *       - Para cada monto cobrado > 0, se valida que la cuenta asociada (`id_cuenta_*`) esté presente y exista en la base de datos.
 *       - Cada venta debe tener `id_servicio_tienda`, `cantidad > 0`, `precio_cobrado_cup >= 0` y `precio_cobrado_usd >= 0`.
 *
 *       **2. Validaciones de negocio:**
 *       - Para cada `id_servicio_tienda` se verifica que el servicio asociado sea un producto (herencia Servicio → Producto).
 *       - Se verifica que el stock (`servicio_tienda.cantidad`) sea >= la cantidad de la venta.
 *       - Se calcula la suma total de las ventas en CUP y en USD.
 *       - Se valida que la suma de las cantidades cobradas en CUP (efectivo + transferencia) coincida con el total de ventas en CUP, y lo mismo en USD (con tolerancia de 0.001 por redondeo).
 *
 *       **3. Transacción (todo o nada):**
 *       - **Crear la lista_venta** con los datos proporcionados.
 *       - **Por cada venta:**
 *           - Se toman automáticamente `precio_original_cup`, `precio_original_usd`, `costo_original_cup`, `costo_original_usd` del `servicio_tienda` relacionado.
 *           - Se crea el registro en `ventas` con todos los campos.
 *           - **Descuento de entradas:** Se seleccionan entradas disponibles (`cantidad_restante > 0`) para el servicio_tienda, ordenadas primero por fecha de vencimiento más cercana (si el producto es vencible) o por fecha de creación más antigua (FIFO). Por cada entrada utilizada, se descuenta la cantidad correspondiente y se crea un registro en `venta_entrada` con la cantidad descontada de esa entrada.
 *           - Se resta la cantidad vendida del stock (`servicio_tienda.cantidad`).
 *       - **Por cada forma de cobro** (efectivo CUP, efectivo USD, transferencia CUP, transferencia USD) cuyo monto > 0:
 *           - Se crea una operación de tipo "Ingreso" asociada a la lista_venta, con el usuario y la cuenta correspondiente.
 *           - La operación se crea con el monto de la forma de cobro en `cantidad_operacion`, y el resto de campos como `motivo = "Ingreso por Venta"`, `fecha_hora = fecha_hora de la lista`.
 *           - Se actualiza el `fondo` de la cuenta sumando el monto cobrado.
 *
 *       **4. Respuesta:**
 *       Se devuelve la lista_venta creada con todas sus relaciones (ventas, sus entradas, servicio_tienda, tienda, servicio, producto; y operaciones con usuario y cuenta).
 *
 *       **Nota:** La selección de entradas sigue la misma política que en las salidas: para productos vencibles se priorizan las fechas de vencimiento más cercanas; para no vencibles, se usan las entradas más antiguas (FIFO).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fecha_hora
 *               - ventas
 *               - id_usuario
 *               - cambio_moneda
 *             properties:
 *               fecha_hora:
 *                 type: string
 *                 format: date-time
 *               nota:
 *                 type: string
 *               cantidad_cobrada_efectivo_cup:
 *                 type: number
 *                 default: 0
 *               cantidad_cobrada_efectivo_usd:
 *                 type: number
 *                 default: 0
 *               cantidad_cobrada_transferencia_cup:
 *                 type: number
 *                 default: 0
 *               cantidad_cobrada_transferencia_usd:
 *                 type: number
 *                 default: 0
 *               id_cuenta_efectivo_cup:
 *                 type: integer
 *                 description: Obligatorio si cantidad_cobrada_efectivo_cup > 0
 *               id_cuenta_efectivo_usd:
 *                 type: integer
 *                 description: Obligatorio si cantidad_cobrada_efectivo_usd > 0
 *               id_cuenta_transferencia_cup:
 *                 type: integer
 *                 description: Obligatorio si cantidad_cobrada_transferencia_cup > 0
 *               id_cuenta_transferencia_usd:
 *                 type: integer
 *                 description: Obligatorio si cantidad_cobrada_transferencia_usd > 0
 *               id_usuario:
 *                 type: integer
 *               cambio_moneda:
 *                 type: number
 *               ventas:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - id_servicio_tienda
 *                     - cantidad
 *                     - precio_cobrado_cup
 *                     - precio_cobrado_usd
 *                   properties:
 *                     id_servicio_tienda:
 *                       type: integer
 *                     cantidad:
 *                       type: number
 *                     precio_cobrado_cup:
 *                       type: number
 *                     precio_cobrado_usd:
 *                       type: number
 *     responses:
 *       201:
 *         description: Lista de ventas creada exitosamente
 *       400:
 *         description: Datos inválidos (validaciones de negocio)
 *       404:
 *         description: Recurso no encontrado
 *       500:
 *         description: Error interno
 */
router.post("/lista-venta", authenticate(), listaVentaController.createListaVenta);

/**
 * @swagger
 * /lista-venta/{id}:
 *   delete:
 *     summary: Eliminar una lista de ventas (revierte todo el proceso)
 *     tags: [ListaVenta]
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
 *         description: Lista eliminada correctamente
 *       400:
 *         description: No se puede eliminar
 *       404:
 *         description: No encontrada
 */
router.delete("/lista-venta/:id", authenticate(), listaVentaController.deleteListaVenta);

module.exports = router;