// services/usuarioService.js

const { Usuario } = require("../models/usuario");
const { Op } = require("sequelize");
const { throwError } = require("../helpers/errorLauncher");

/**
 * Obtener todos los usuarios (sin paginación).
 * Se usa internamente, pero no como endpoint público.
 */
const getAllUsuarios = async () => {
  try {
    return await Usuario.findAll();
  } catch (error) {
    throwError("Error al obtener los usuarios", 500, error.message);
  }
};

/**
 * Obtener un usuario por ID.
 */
const getUsuarioById = async (id) => {
  const usuario = await Usuario.findByPk(id);
  if (!usuario) {
    throwError("Usuario no encontrado", 404);
  }
  return usuario;
};

/**
 * Verificar si un nombre de usuario ya existe.
 */
const usuarioExists = async (nombre_usuario) => {
  const count = await Usuario.count({ where: { nombre_usuario } });
  return count > 0;
};

/**
 * Crear un nuevo usuario (la contraseña ya debe estar hasheada).
 */
const createUsuario = async (usuarioData) => {
  // Verificar que el nombre de usuario no exista
  const exists = await usuarioExists(usuarioData.nombre_usuario);
  if (exists) {
    throwError(`El nombre de usuario "${usuarioData.nombre_usuario}" ya está en uso`, 400);
  }

  // Asegurar valores por defecto
  const data = {
    ...usuarioData,
    salario_diario: usuarioData.salario_diario || 0,
    activo: usuarioData.activo !== undefined ? usuarioData.activo : true,
  };

  try {
    return await Usuario.create(data);
  } catch (error) {
    // Manejar errores de validación de Sequelize
    if (error.name === "SequelizeValidationError") {
      const messages = error.errors.map((e) => e.message);
      throwError("Error de validación", 400, messages);
    }
    // Si ya es un error lanzado por throwError, relanzarlo
    if (error.status && error.errors) {
      throw error;
    }
    // Para cualquier otro error, lanzar con throwError
    throwError(error.message || "Error al crear usuario", 500);
  }
};

/**
 * Actualizar un usuario existente.
 */
const updateUsuario = async (id, userData) => {
  const usuario = await Usuario.findByPk(id);
  if (!usuario) {
    throwError("Usuario no encontrado", 404);
  }

  // Si se actualiza el nombre de usuario, verificar que no esté en uso por otro
  if (userData.nombre_usuario && userData.nombre_usuario !== usuario.nombre_usuario) {
    const exists = await usuarioExists(userData.nombre_usuario);
    if (exists) {
      throwError(`El nombre de usuario "${userData.nombre_usuario}" ya está en uso`, 400);
    }
  }

  try {
    await usuario.update(userData);
    return usuario;
  } catch (error) {
    if (error.name === "SequelizeValidationError") {
      const messages = error.errors.map((e) => e.message);
      throwError("Error de validación", 400, messages);
    }
    if (error.status && error.errors) {
      throw error;
    }
    throwError(error.message || "Error al actualizar usuario", 500);
  }
};

/**
 * Eliminar un usuario (sin restricciones de dependencias).
 */
const deleteUsuario = async (id) => {
  const usuario = await Usuario.findByPk(id);
  if (!usuario) {
    throwError("Usuario no encontrado", 404);
  }
  await usuario.destroy();
  return true;
};

/**
 * Obtener un usuario por nombre de usuario (para login).
 */
const getUsuarioByNombreUsuario = async (nombre_usuario) => {
  const usuario = await Usuario.findOne({ where: { nombre_usuario } });
  return usuario; // puede ser null
};

/**
 * Filtrar usuarios con paginación opcional.
 * @param {Object} filterCriteria - { nombre_natural, nombre_usuario, rol, activo }
 * @param {number} limit - Número de registros por página (opcional, si es null devuelve todos)
 * @param {number} offset - Desplazamiento (requerido si limit es null, se ignora)
 * @returns {Object} - { rows, count }
 */
const filterUsuarios = async (filterCriteria = {}, limit = null, offset = 0) => {
  const whereClause = {};

  // Construir filtros (búsqueda parcial e insensible a mayúsculas)
  for (const [key, value] of Object.entries(filterCriteria)) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "boolean" || typeof value === "number") {
      whereClause[key] = value;
    } else {
      whereClause[key] = { [Op.iLike]: `%${value}%` };
    }
  }

  const options = {
    where: whereClause,
    order: [["id_usuario", "ASC"]],
  };

  // Aplicar paginación solo si limit es un número positivo
  if (limit !== null && limit > 0) {
    options.limit = limit;
    options.offset = offset || 0;
  }

  const result = await Usuario.findAndCountAll(options);
  return result; // { rows, count }
};

module.exports = {
  getAllUsuarios,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  usuarioExists,
  getUsuarioByNombreUsuario,
  filterUsuarios,
};