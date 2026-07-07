const express = require("express");
const router = express.Router();
const tiendaController = require("../controllers/tiendaController");
const authenticate = require("../helpers/authenticate");

/**
 * @swagger
 * tags:
 *   name: Tiendas
 *   description: Gestión de tiendas
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Tienda:
 *       type: object
 *       properties:
 *         id_tienda:
 *           type: integer
 *         nombre:
 *           type: string
 *         tipo:
 *           type: string
 *         activo:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       required:
 *         - nombre
 *         - tipo
 */

/**
 * @swagger
 * /tienda/filter:
 *   get:
 *     summary: Filtrar tiendas con paginación
 *     tags: [Tiendas]
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
 *         name: nombre
 *         schema:
 *           type: string
 *         description: Filtro parcial por nombre
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *         description: Filtro parcial por tipo
 *       - in: query
 *         name: activo
 *         schema:
 *           type: boolean
 *         description: Filtro por estado activo
 *     responses:
 *       200:
 *         description: Lista de tiendas con paginación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Tienda'
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
 */
router.get("/tienda/filter", authenticate(), tiendaController.filterTiendas);

/**
 * @swagger
 * /tienda/{id}:
 *   get:
 *     summary: Obtener una tienda por ID
 *     tags: [Tiendas]
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
 *         description: Tienda encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tienda'
 *       404:
 *         description: Tienda no encontrada
 */
router.get("/tienda/:id", authenticate(), tiendaController.getTiendaById);

/**
 * @swagger
 * /tienda:
 *   post:
 *     summary: Crear una nueva tienda
 *     tags: [Tiendas]
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
 *               - tipo
 *             properties:
 *               nombre:
 *                 type: string
 *               tipo:
 *                 type: string
 *               activo:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Tienda creada
 *       400:
 *         description: Datos inválidos
 */
router.post("/tienda", authenticate(), tiendaController.createTienda);

/**
 * @swagger
 * /tienda/{id}:
 *   put:
 *     summary: Actualizar una tienda existente
 *     tags: [Tiendas]
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
 *               tipo:
 *                 type: string
 *               activo:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Tienda actualizada
 *       404:
 *         description: Tienda no encontrada
 */
router.put("/tienda/:id", authenticate(), tiendaController.updateTienda);

/**
 * @swagger
 * /tienda/{id}:
 *   delete:
 *     summary: Eliminar una tienda
 *     tags: [Tiendas]
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
 *         description: Tienda eliminada
 *       404:
 *         description: Tienda no encontrada
 */
router.delete("/tienda/:id", authenticate(), tiendaController.deleteTienda);

module.exports = router;