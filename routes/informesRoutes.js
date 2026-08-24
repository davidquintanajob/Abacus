const express = require("express");
const informesController = require("../controllers/informesController");
const authenticate = require("../helpers/authenticate");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Informes
 *   description: Consultas generales para informes
 */

/**
 * @swagger
 * /informes/generalInformation:
 *   get:
 *     summary: Obtener información general del inventario y las ventas del día
 *     tags: [Informes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Información general del sistema
 *       500:
 *         description: Error interno del servidor
 */
router.get("/informes/generalInformation", authenticate(), informesController.getGeneralInformation);

module.exports = router;