const express = require("express");
const router = express.Router();
const productoController = require("../controllers/productoController");
const authenticate = require("../helpers/authenticate");

/**
 * @swagger
 * tags:
 *   name: Productos
 *   description: Gestión de productos
 */

/**
 * @swagger
 * /producto/filter:
 *   get:
 *     summary: Filtrar productos con paginación
 *     tags: [Productos]
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
 *         name: codigo
 *         schema:
 *           type: string
 *         description: Búsqueda exacta por código de barras EAN asociado al producto
 *       - in: query
 *         name: categoria
 *         schema:
 *           type: string
 *       - in: query
 *         name: esvendible
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: id_tienda
 *         schema:
 *           type: integer
 *         description: Si se envía, filtra los productos asociados a esa tienda y aplica el rango de cantidad sobre esa tienda.
 *       - in: query
 *         name: cantidad_min
 *         schema:
 *           type: number
 *         description: Rango mínimo de cantidad. Si no se envía id_tienda, se suma la cantidad de todas las tiendas del producto.
 *       - in: query
 *         name: cantidad_max
 *         schema:
 *           type: number
 *         description: Rango máximo de cantidad. Si no se envía id_tienda, se suma la cantidad de todas las tiendas del producto.
 *     responses:
 *       200:
 *         description: Lista de productos con paginación
 */
router.get("/producto/filter", authenticate(), productoController.filterProductos);

/**
 * @swagger
 * /producto/alerta:
 *   get:
 *     summary: Obtener productos en alerta de stock
 *     tags: [Productos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: id_tienda
 *         schema:
 *           type: integer
 *         description: Si se envía, aplica la validación solo a esa tienda. Si no, la aplica a todas las tiendas del producto.
 *     responses:
 *       200:
 *         description: Lista de productos que cumplen con la condición de alerta
 */
router.get("/producto/alerta", authenticate(), productoController.getProductosEnAlerta);

/**
 * @swagger
 * /producto/{id}:
 *   get:
 *     summary: Obtener un producto por ID
 *     tags: [Productos]
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
 *         description: Producto encontrado
 *       404:
 *         description: Producto no encontrado
 */
router.get("/producto/:id", authenticate(), productoController.getProductoById);

/**
 * @swagger
 * /producto:
 *   post:
 *     summary: Crear un nuevo producto
 *     tags: [Productos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *               - categoria
 *               - sufijo
 *               - codigoList
 *             properties:
 *               nombre:
 *                 type: string
 *               codigoList:
 *                 type: array
 *                 description: Lista de códigos de barras asociados al producto. Debe incluir al menos un elemento.
 *                 items:
 *                   type: object
 *                   required:
 *                     - codigo_barras_ean
 *                   properties:
 *                     codigo_barras_ean:
 *                       type: string
 *                     nota:
 *                       type: string
 *               categoria:
 *                 type: string
 *               esvendible:
 *                 type: boolean
 *               nota:
 *                 type: string
 *               imagen:
 *                 type: string
 *               sufijo:
 *                 type: string
 *               isVencible:
 *                 type: boolean
 *               unidad_medida:
 *                 type: string
 *               productoTiendaList:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - id_tienda
 *                     - precio_cup
 *                     - precio_usd
 *                     - costo_cup
 *                     - costo_usd
 *                   properties:
 *                     id_tienda:
 *                       type: integer
 *                     precio_cup:
 *                       type: number
 *                     precio_usd:
 *                       type: number
 *                     costo_cup:
 *                       type: number
 *                     costo_usd:
 *                       type: number
 *                     cantidad_alerta:
 *                       type: number
 *     responses:
 *       201:
 *         description: Producto creado
 *       400:
 *         description: Datos inválidos
 */
router.post("/producto", authenticate(), productoController.createProducto);

/**
 * @swagger
 * /producto/{id}:
 *   put:
 *     summary: Actualizar un producto existente
 *     tags: [Productos]
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
 *               nombre:
 *                 type: string
 *               codigoList:
 *                 type: array
 *                 description: Lista de códigos de barras asociados al producto. Debe incluir al menos un elemento.
 *                 items:
 *                   type: object
 *                   required:
 *                     - codigo_barras_ean
 *                   properties:
 *                     codigo_barras_ean:
 *                       type: string
 *                     nota:
 *                       type: string
 *               categoria:
 *                 type: string
 *               esvendible:
 *                 type: boolean
 *               nota:
 *                 type: string
 *               imagen:
 *                 type: string
 *               sufijo:
 *                 type: string
 *               isVencible:
 *                 type: boolean
 *               unidad_medida:
 *                 type: string
 *               productoTiendaList:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id_tienda:
 *                       type: integer
 *                     precio_cup:
 *                       type: number
 *                     precio_usd:
 *                       type: number
 *                     costo_cup:
 *                       type: number
 *                     costo_usd:
 *                       type: number
 *                     cantidad_alerta:
 *                       type: number
 *     responses:
 *       200:
 *         description: Producto actualizado
 *       404:
 *         description: Producto no encontrado
 */
router.put("/producto/:id", authenticate(), productoController.updateProducto);
/**
 * @swagger
 * /producto/{id}:
 *   delete:
 *     summary: Eliminar un producto
 *     tags: [Productos]
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
 *         description: Producto eliminado correctamente
 *       400:
 *         description: No se puede eliminar porque tiene entradas o salidas asociadas
 *       404:
 *         description: Producto no encontrado
 */
router.delete("/producto/:id", authenticate(), productoController.deleteProducto);

module.exports = router;
