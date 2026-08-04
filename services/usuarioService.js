const { Usuario } = require("../models/usuario");
const { Tienda } = require("../models/tienda"); // Importamos Tienda para validar
const { Op } = require("sequelize");
const { throwError } = require("../helpers/errorLauncher");

/**
 * Obtener todos los usuarios (sin paginación) – uso interno.
 * Incluye la tienda asociada.
 */
const getAllUsuarios = async () => {
  try {
    return await Usuario.findAll({
      include: [{ model: Tienda, as: 'tienda' }]
    });
  } catch (error) {
    throwError("Error al obtener los usuarios", 500, error.message);
  }
};

/**
 * Obtener un usuario por ID, incluyendo su tienda.
 */
const getUsuarioById = async (id) => {
  const usuario = await Usuario.findByPk(id, {
    include: [{ model: Tienda, as: 'tienda' }]
  });
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
 * Verificar que una tienda existe.
 */
const tiendaExists = async (id_tienda) => {
  const count = await Tienda.count({ where: { id_tienda } });
  return count > 0;
};

/**
 * Crear un nuevo usuario (la contraseña ya debe estar hasheada).
 * Requiere id_tienda válido.
 */
const createUsuario = async (usuarioData) => {
  // Validar que la tienda exista
  if (!usuarioData.id_tienda) {
    throwError("id_tienda es requerido", 400);
  }
  const tiendaValida = await tiendaExists(usuarioData.id_tienda);
  if (!tiendaValida) {
    throwError(`La tienda con id ${usuarioData.id_tienda} no existe`, 400);
  }

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
    const newUsuario = await Usuario.create(data);
    // Devolver el usuario con su tienda
    return await getUsuarioById(newUsuario.id_usuario);
  } catch (error) {
    if (error.name === "SequelizeValidationError") {
      const messages = error.errors.map((e) => e.message);
      throwError("Error de validación", 400, messages);
    }
    if (error.status && error.errors) {
      throw error;
    }
    throwError(error.message || "Error al crear usuario", 500);
  }
};

/**
 * Actualizar un usuario existente.
 * Si se cambia id_tienda, se valida que la nueva tienda exista.
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

  // Validar nueva tienda si se proporciona
  if (userData.id_tienda !== undefined) {
    if (!userData.id_tienda) {
      throwError("id_tienda no puede ser nulo", 400);
    }
    const tiendaValida = await tiendaExists(userData.id_tienda);
    if (!tiendaValida) {
      throwError(`La tienda con id ${userData.id_tienda} no existe`, 400);
    }
  }

  try {
    await usuario.update(userData);
    // Devolver el usuario actualizado con su tienda
    return await getUsuarioById(usuario.id_usuario);
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
 * Incluye la tienda.
 */
const getUsuarioByNombreUsuario = async (nombre_usuario) => {
  const usuario = await Usuario.findOne({
    where: { nombre_usuario },
    include: [{ model: Tienda, as: 'tienda' }]
  });
  return usuario; // puede ser null
};

/**
 * Filtrar usuarios con paginación obligatoria.
 * Soporta filtros: nombre_natural, nombre_usuario, rol, activo, id_tienda.
 * Incluye la tienda en cada registro.
 */
const filterUsuarios = async (filterCriteria = {}, limit = 10, offset = 0) => {
  const whereClause = {};

  // Construir filtros (búsqueda parcial e insensible a mayúsculas)
  for (const [key, value] of Object.entries(filterCriteria)) {
    if (value === undefined || value === null || value === "") continue;
    // Para id_tienda usamos igualdad exacta
    if (key === 'id_tienda') {
      whereClause[key] = value;
    } else if (typeof value === "boolean" || typeof value === "number") {
      whereClause[key] = value;
    } else {
      whereClause[key] = { [Op.iLike]: `%${value}%` };
    }
  }

  const options = {
    where: whereClause,
    order: [["createdAt", "DESC"]],
    limit,
    offset,
    include: [{ model: Tienda, as: 'tienda' }]
  };

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