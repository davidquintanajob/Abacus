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
 *     description: |
 *       Permite actualizar la configuración general. 
 *       
 *       **Nota sobre `monedaConfig`**:  
 *       Si se envía una propiedad `monedaConfig` en el cuerpo, esta se procesa de forma especial: 
 *       se valida su estructura, se imprime en consola (por ahora) y **no** se guarda en el archivo. 
 *       El resto de las propiedades se persisten normalmente.
 *       
 *       **Campos obligatorios de `monedaConfig` y sus valores válidos:**
 *       - `modificarSoloServicios`: booleano (`true` o `false`).
 *       - `datosModificar`: string, debe ser exactamente `"costos"`, `"precios"` o `"ambos"`.
 *       - `tipoDatoModificar`: string, debe ser `"cup"` o `"usd"`.
 *       - `monedaValor`: número mayor que 0 (p.ej., `1.5`).
 *       
 *       Si alguno de estos campos no cumple con el tipo o valor esperado, la petición será rechazada con un error 400.
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
 *             monedaConfig:
 *               modificarSoloServicios: true
 *               datosModificar: "costos"
 *               tipoDatoModificar: "cup"
 *               monedaValor: 1.5
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
 *         description: |
 *           El cuerpo no es un JSON válido, está vacío, o `monedaConfig` tiene un formato inválido.
 *           Los errores específicos para `monedaConfig` pueden ser:
 *           - Debe ser un objeto
 *           - modificarSoloServicios debe ser booleano
 *           - datosModificar debe ser "costos", "precios" o "ambos"
 *           - tipoDatoModificar debe ser "cup" o "usd"
 *           - monedaValor debe ser un número mayor que 0
 *       500:
 *         description: Error interno del servidor
 */
router.put('/', authenticate(), configController.updateConfig);

module.exports = router;