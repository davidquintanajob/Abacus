const { Router } = require('express');
const configController = require('../controllers/configController');
const authenticate = require("../helpers/authenticate");

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Configuración
 *   description: Gestión del archivo de configuración local
 */

/**
 * @swagger
 * /config:
 *   get:
 *     summary: Obtener la configuración actual desde local_config/config.json
 *     tags: [Configuración]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Objeto de configuración (o {} si el archivo no existe)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: true
 *       500:
 *         description: Error interno del servidor
 */
router.get('/', authenticate(), configController.getConfig);

/**
 * @swagger
 * /config:
 *   put:
 *     summary: Actualizar el archivo de configuración
 *     tags: [Configuración]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *           example:
 *             clave: "valor"
 *             otro: 123
 *     responses:
 *       200:
 *         description: Configuración actualizada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   additionalProperties: true
 *       400:
 *         description: El cuerpo no es un JSON válido o está vacío
 *       500:
 *         description: Error interno del servidor
 */
router.put('/', authenticate(), configController.updateConfig);

module.exports = router;