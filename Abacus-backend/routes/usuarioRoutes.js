const express = require("express");
const router = express.Router();
const usuarioController = require("../controllers/usuarioController");
const authenticate = require("../helpers/authenticate");

/**
 * @swagger
 * tags:
 *   name: Usuarios
 *   description: Gestión de usuarios
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Usuario:
 *       type: object
 *       properties:
 *         id_usuario:
 *           type: integer
 *         nombre_natural:
 *           type: string
 *         telefono:
 *           type: string
 *         direccion:
 *           type: string
 *         nombre_usuario:
 *           type: string
 *         salario_diario:
 *           type: number
 *         rol:
 *           type: string
 *           enum: [Administrador, Médico, Técnico, Estilista]
 *         activo:
 *           type: boolean
 *         id_tienda:
 *           type: integer
 *         tienda:
 *           $ref: '#/components/schemas/Tienda'
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
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
 */

/**
 * @swagger
 * /usuario/filter:
 *   get:
 *     summary: Filtrar usuarios con paginación
 *     tags: [Usuarios]
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
 *         name: nombre_natural
 *         schema:
 *           type: string
 *         description: Filtro parcial por nombre natural
 *       - in: query
 *         name: nombre_usuario
 *         schema:
 *           type: string
 *         description: Filtro parcial por nombre de usuario
 *       - in: query
 *         name: rol
 *         schema:
 *           type: string
 *         description: Filtro exacto por rol
 *       - in: query
 *         name: activo
 *         schema:
 *           type: boolean
 *         description: Filtro por estado activo
 *       - in: query
 *         name: id_tienda
 *         schema:
 *           type: integer
 *         description: Filtro exacto por ID de tienda
 *     responses:
 *       200:
 *         description: Lista de usuarios con paginación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Usuario'
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
router.get("/usuario/filter", authenticate(), usuarioController.filterUsuarios);

/**
 * @swagger
 * /usuario/{id}:
 *   get:
 *     summary: Obtener un usuario por ID
 *     tags: [Usuarios]
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
 *         description: Usuario encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Usuario'
 *       404:
 *         description: Usuario no encontrado
 */
router.get("/usuario/:id", authenticate(), usuarioController.getUsuarioById);

/**
 * @swagger
 * /usuario:
 *   post:
 *     summary: Crear un nuevo usuario
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre_natural
 *               - nombre_usuario
 *               - contrasenna
 *               - rol
 *               - id_tienda
 *             properties:
 *               nombre_natural:
 *                 type: string
 *               telefono:
 *                 type: string
 *               direccion:
 *                 type: string
 *               nombre_usuario:
 *                 type: string
 *               contrasenna:
 *                 type: string
 *               salario_diario:
 *                 type: number
 *               rol:
 *                 type: string
 *                 enum: [Administrador, Médico, Técnico, Estilista]
 *               activo:
 *                 type: boolean
 *               id_tienda:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Usuario creado
 *       400:
 *         description: Datos inválidos
 */
router.post("/usuario", authenticate(), usuarioController.createUsuario);

/**
 * @swagger
 * /usuario/{id}:
 *   put:
 *     summary: Actualizar un usuario existente
 *     tags: [Usuarios]
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
 *               nombre_natural:
 *                 type: string
 *               telefono:
 *                 type: string
 *               direccion:
 *                 type: string
 *               nombre_usuario:
 *                 type: string
 *               contrasenna:
 *                 type: string
 *               salario_diario:
 *                 type: number
 *               rol:
 *                 type: string
 *                 enum: [Administrador, Médico, Técnico, Estilista]
 *               activo:
 *                 type: boolean
 *               id_tienda:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Usuario actualizado
 *       404:
 *         description: Usuario no encontrado
 */
router.put("/usuario/:id", authenticate(), usuarioController.updateUsuario);

/**
 * @swagger
 * /usuario/{id}:
 *   delete:
 *     summary: Eliminar un usuario
 *     tags: [Usuarios]
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
 *         description: Usuario eliminado
 *       404:
 *         description: Usuario no encontrado
 */
router.delete("/usuario/:id", authenticate(), usuarioController.deleteUsuario);

/**
 * @swagger
 * /usuario/login:
 *   post:
 *     summary: Iniciar sesión de usuario
 *     tags: [Usuarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre_usuario
 *               - contrasenna
 *             properties:
 *               nombre_usuario:
 *                 type: string
 *               contrasenna:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login exitoso, devuelve token, refreshToken y datos del usuario (incluye tienda)
 *       401:
 *         description: Contraseña incorrecta
 *       404:
 *         description: Usuario no encontrado
 */
router.post("/usuario/login", usuarioController.login);

/**
 * @swagger
 * /usuario/changePassword:
 *   post:
 *     summary: Cambiar contraseña del usuario autenticado
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - viejaContrasenna
 *               - nuevaContrasenna
 *             properties:
 *               viejaContrasenna:
 *                 type: string
 *               nuevaContrasenna:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contraseña actualizada
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: Contraseña actual incorrecta
 *       403:
 *         description: Token inválido o faltante
 */
router.post("/usuario/changePassword", authenticate(), usuarioController.changePassword);

module.exports = router;