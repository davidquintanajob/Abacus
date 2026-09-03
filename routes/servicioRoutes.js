const express = require("express");
const router = express.Router();
const servicioController = require("../controllers/servicioController");
const authenticate = require("../helpers/authenticate");

/**
 * @swagger
 * tags:
 *   name: Servicios
 *   description: Gestión de servicios y productos
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Servicio:
 *       type: object
 *       properties:
 *         id_servicio:
 *           type: integer
 *         nombre:
 *           type: string
 *         esvendible:
 *           type: boolean
 *         categoria:
 *           type: string
 *         codigos:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Codigo'
 *         nota:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         producto:
 *           $ref: '#/components/schemas/Producto'
 *         tiendas:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ServicioTienda'
 *         componentes:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Oferta'
 *         ofertas_que_incluyen:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Oferta'
 *     ServicioTienda:
 *       type: object
 *       properties:
 *         id_servicio_tienda:
 *           type: integer
 *         id_tienda:
 *           type: integer
 *         precio_cup:
 *           type: number
 *         precio_usd:
 *           type: number
 *         costo_cup:
 *           type: number
 *         costo_usd:
 *           type: number
 *         tienda:
 *           $ref: '#/components/schemas/Tienda'
 *     Oferta:
 *       type: object
 *       properties:
 *         id_servicio_oferta:
 *           type: integer
 *         id_servicio_componente:
 *           type: integer
 *         cantidad:
 *           type: number
 *         servicio_componente:
 *           $ref: '#/components/schemas/Servicio'
 *     Producto:
 *       type: object
 *       properties:
 *         id_servicio:
 *           type: integer
 *         imagen:
 *           type: string
 *         sufijo:
 *           type: string
 *         isVencible:
 *           type: boolean
 *         unidad_medida:
 *           type: string
 *     Codigo:
 *       type: object
 *       properties:
 *         id_codigo:
 *           type: integer
 *         id_servicio:
 *           type: integer
 *         codigo_barras_ean:
 *           type: string
 *         nota:
 *           type: string
 */

/**
 * @swagger
 * /servicio/filter:
 *   get:
 *     summary: Filtrar servicios con paginación
 *     tags: [Servicios]
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
 *         description: Filtro parcial por nombre
 *       - in: query
 *         name: codigo
 *         schema:
 *           type: string
 *         description: Búsqueda exacta por código de barras EAN asociado al servicio
 *       - in: query
 *         name: categoria
 *         schema:
 *           type: string
 *         description: Filtro parcial por categoría
 *       - in: query
 *         name: esvendible
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: tienda_nombre
 *         schema:
 *           type: string
 *         description: Filtro parcial por nombre de tienda (búsqueda en las tiendas asociadas)
 *       - in: query
 *         name: id_tienda
 *         schema:
 *           type: integer
 *         description: Filtro por ID de tienda para devolver los servicios asociados a esa tienda
 *       - in: query
 *         name: fetchProducto
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Si es false, devuelve solo los servicios que no son productos. Si es true, devuelve todos los servicios, incluidos los que son productos.
 *       - in: query
 *         name: conStock
 *         schema:
 *           type: boolean
 *           default: false
 *         description: |
 *           Solo tiene efecto cuando fetchProducto=true y se filtra por tienda (id_tienda o tienda_nombre).
 *           Si es true, los productos se filtran para incluir solo aquellos con cantidad > 0 en la tienda especificada.
 *           Los servicios que no son productos se devuelven sin esta restricción.
 *     responses:
 *       200:
 *         description: Lista de servicios con paginación
 *       400:
 *         description: Parámetros inválidos o conflicto de condiciones
 */
router.get("/servicio/filter", authenticate(), servicioController.filterServicios);

/**
 * @swagger
 * /servicio/{id}:
 *   get:
 *     summary: Obtener un servicio por ID
 *     tags: [Servicios]
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
 *         description: Servicio encontrado
 *       404:
 *         description: Servicio no encontrado
 */
router.get("/servicio/:id", authenticate(), servicioController.getServicioById);

/**
 * @swagger
 * /servicio/codigo/{codigo}:
 *   get:
 *     summary: Obtener un servicio por su código de barras EAN
 *     tags: [Servicios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: codigo
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Servicio encontrado
 *       404:
 *         description: Servicio no encontrado
 */
router.get("/servicio/codigo/:codigo", authenticate(), servicioController.getServicioByCodigo);

/**
 * @swagger
 * /servicio:
 *   post:
 *     summary: Crear un nuevo servicio
 *     tags: [Servicios]
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
 *               - codigoList
 *             properties:
 *               nombre:
 *                 type: string
 *               codigoList:
 *                 type: array
 *                 description: Lista de códigos de barras asociados al servicio. Debe incluir al menos un elemento.
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
 *               servicioTiendaList:
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
 *               ofertaList:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - id_servicio_componente
 *                     - cantidad
 *                   properties:
 *                     id_servicio_componente:
 *                       type: integer
 *                     cantidad:
 *                       type: number
 *     responses:
 *       201:
 *         description: Servicio creado
 *       400:
 *         description: Datos inválidos
 */
router.post("/servicio", authenticate(), servicioController.createServicio);

/**
 * @swagger
 * /servicio/{id}:
 *   put:
 *     summary: Actualizar un servicio existente
 *     tags: [Servicios]
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
 *                 description: Lista de códigos de barras asociados al servicio. Debe incluir al menos un elemento.
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
 *               servicioTiendaList:
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
 *               ofertaList:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id_servicio_componente:
 *                       type: integer
 *                     cantidad:
 *                       type: number
 *     responses:
 *       200:
 *         description: Servicio actualizado
 *       404:
 *         description: Servicio no encontrado
 */
router.put("/servicio/:id", authenticate(), servicioController.updateServicio);

/**
 * @swagger
 * /servicio/{id}:
 *   delete:
 *     summary: Eliminar un servicio y todas sus relaciones (producto, tiendas, ofertas, códigos)
 *     tags: [Servicios]
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
 *         description: Servicio eliminado correctamente
 *       404:
 *         description: Servicio no encontrado
 *       500:
 *         description: Error interno
 */
router.delete("/servicio/:id", authenticate(), servicioController.deleteServicio);
module.exports = router;