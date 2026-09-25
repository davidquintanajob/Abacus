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
 *         name: tipo_cliente
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de clientes con paginación
 */
router.get("/cliente/filter", authenticate(), clienteController.filterClientes);

/**
 * @swagger
 * /cliente/{id}:
 *   get:
 *     summary: Obtener un cliente por ID
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
 *     summary: Crear un nuevo cliente
 *     tags: [Clientes]
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
 *     summary: Actualizar un cliente existente
 *     tags: [Clientes]
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