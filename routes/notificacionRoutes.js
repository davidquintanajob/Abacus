const express = require("express");
const router = express.Router();
const notificacionController = require("../controllers/notificacionController");
const authenticate = require("../helpers/authenticate");

/**
 * @swagger
 * tags:
 *   name: Notificaciones
 *   description: Creación, actualización y filtrado de notificaciones por usuario.
 */

/**
 * @swagger
 * /notificacion:
 *   post:
 *     summary: Crear notificaciones para usuarios o para todos los usuarios de una tienda
 *     description: |
 *       Se debe enviar id_usuarios o id_tienda, nunca ambos. Las notificaciones
 *       siempre se crean con is_read=false. Emite el evento Socket.IO
 *       "notification:new" en la sala privada de cada destinatario.
 *     tags: [Notificaciones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [titulo, mensaje, fecha_hora, tipo]
 *             properties:
 *               titulo:
 *                 type: string
 *               mensaje:
 *                 type: string
 *               fecha_hora:
 *                 type: string
 *                 format: date-time
 *               tipo:
 *                 type: string
 *                 enum: [Información, Éxito, Advertencia, Error]
 *               id_relacion:
 *                 type: string
 *                 nullable: true
 *               id_usuarios:
 *                 type: array
 *                 items:
 *                   type: integer
 *               id_tienda:
 *                 type: integer
 *               is_read:
 *                 type: boolean
 *                 description: Debe omitirse o ser false; true se rechaza.
 *     responses:
 *       201:
 *         description: Notificaciones creadas y emitidas a los destinatarios conectados.
 *       400:
 *         description: Datos inválidos o destinatarios incorrectos.
 *       401:
 *         description: Token de autenticación inválido.
 */
router.post("/notificacion", authenticate(), notificacionController.createNotification);

/**
 * @swagger
 * /notificacion:
 *   put:
 *     summary: Actualizar todas las notificaciones de usuarios o de una tienda
 *     description: |
 *       Se debe enviar id_usuarios o id_tienda, nunca ambos. Actualiza todas las
 *       notificaciones existentes pertenecientes a esos usuarios y emite
 *       "notification:updated" a cada destinatario.
 *     tags: [Notificaciones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               titulo:
 *                 type: string
 *               mensaje:
 *                 type: string
 *               fecha_hora:
 *                 type: string
 *                 format: date-time
 *               tipo:
 *                 type: string
 *                 enum: [Información, Éxito, Advertencia, Error]
 *               id_relacion:
 *                 type: string
 *                 nullable: true
 *               is_read:
 *                 type: boolean
 *               id_usuarios:
 *                 type: array
 *                 items:
 *                   type: integer
 *               id_tienda:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Notificaciones actualizadas correctamente.
 *       400:
 *         description: Datos inválidos o destinatarios incorrectos.
 *       404:
 *         description: No se encontraron notificaciones para los destinatarios.
 */
router.put("/notificacion", authenticate(), notificacionController.updateNotifications);

/**
 * @swagger
 * /notificacion/filter:
 *   get:
 *     summary: Filtrar notificaciones con paginación
 *     tags: [Notificaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: limit
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: id_usuario
 *         schema:
 *           type: integer
 *       - in: query
 *         name: fecha_desde
 *         schema:
 *           type: string
 *         description: Fecha/hora inicial inclusiva; YYYY-MM-DD comienza a las 00:00 UTC.
 *       - in: query
 *         name: fecha_hasta
 *         schema:
 *           type: string
 *         description: Fecha/hora final inclusiva; YYYY-MM-DD incluye el día completo.
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [Información, Éxito, Advertencia, Error]
 *       - in: query
 *         name: titulo
 *         schema:
 *           type: string
 *         description: Búsqueda parcial del título, sin distinguir mayúsculas.
 *     responses:
 *       200:
 *         description: Notificaciones filtradas y metadatos de paginación.
 *       400:
 *         description: Parámetros de paginación o filtros inválidos.
 */
router.get("/notificacion/filter", authenticate(), notificacionController.filterNotifications);

module.exports = router;
