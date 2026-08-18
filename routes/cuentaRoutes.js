const express = require("express");
const router = express.Router();
const cuentaController = require("../controllers/cuentaController");
const authenticate = require("../helpers/authenticate");

/**
 * @swagger
 * tags:
 *   name: Cuentas
 *   description: Gestión de cuentas financieras
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Cuenta:
 *       type: object
 *       properties:
 *         id_cuenta:
 *           type: integer
 *         nombre:
 *           type: string
 *         tipo_cuenta:
 *           type: string
 *           enum: [Efectivo CUP, Transferencia CUP, Efectivo USD, Transferencia USD]
 *         num_cuenta:
 *           type: string
 *           nullable: true
 *         nota:
 *           type: string
 *           nullable: true
 *         fondo:
 *           type: number
 *           format: double
 *           description: Saldo actual de la cuenta (solo lectura desde este endpoint)
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /cuenta/filter:
 *   get:
 *     summary: Filtrar cuentas con paginación
 *     tags: [Cuentas]
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
 *         name: tipo_cuenta
 *         schema:
 *           type: string
 *         description: Filtro exacto por tipo
 *       - in: query
 *         name: num_cuenta
 *         schema:
 *           type: string
 *         description: Filtro parcial por número de cuenta
 *     responses:
 *       200:
 *         description: Lista de cuentas con paginación
 */
router.get("/cuenta/filter", authenticate(), cuentaController.filterCuentas);

/**
 * @swagger
 * /cuenta/{id}:
 *   get:
 *     summary: Obtener una cuenta por ID
 *     tags: [Cuentas]
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
 *         description: Cuenta encontrada
 *       404:
 *         description: Cuenta no encontrada
 */
router.get("/cuenta/:id", authenticate(), cuentaController.getCuentaById);

/**
 * @swagger
 * /cuenta:
 *   post:
 *     summary: Crear una nueva cuenta
 *     tags: [Cuentas]
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
 *               - tipo_cuenta
 *             properties:
 *               nombre:
 *                 type: string
 *               tipo_cuenta:
 *                 type: string
 *                 enum: [Efectivo CUP, Transferencia CUP, Efectivo USD, Transferencia USD]
 *               num_cuenta:
 *                 type: string
 *                 description: Debe tener entre 12 y 16 caracteres si se proporciona
 *               nota:
 *                 type: string
 *     responses:
 *       201:
 *         description: Cuenta creada exitosamente
 *       400:
 *         description: Datos inválidos
 */
router.post("/cuenta", authenticate(), cuentaController.createCuenta);

/**
 * @swagger
 * /cuenta/{id}:
 *   put:
 *     summary: Actualizar una cuenta existente
 *     tags: [Cuentas]
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
 *               tipo_cuenta:
 *                 type: string
 *                 enum: [Efectivo CUP, Transferencia CUP, Efectivo USD, Transferencia USD]
 *               num_cuenta:
 *                 type: string
 *               nota:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cuenta actualizada
 *       404:
 *         description: Cuenta no encontrada
 */
router.put("/cuenta/:id", authenticate(), cuentaController.updateCuenta);

/**
 * @swagger
 * /cuenta/{id}:
 *   delete:
 *     summary: Eliminar una cuenta
 *     tags: [Cuentas]
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
 *         description: Cuenta eliminada correctamente
 *       400:
 *         description: No se puede eliminar porque tiene operaciones asociadas
 *       404:
 *         description: Cuenta no encontrada
 */
router.delete("/cuenta/:id", authenticate(), cuentaController.deleteCuenta);

module.exports = router;