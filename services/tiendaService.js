const { Tienda } = require("../models/tienda");
const { Op } = require("sequelize");
const { throwError } = require("../helpers/errorLauncher");

/**
 * Obtener todas las tiendas (sin paginación) – uso interno.
 */
const getAllTiendas = async () => {
  try {
    return await Tienda.findAll();
  } catch (error) {
    throwError("Error al obtener las tiendas", 500, error.message);
  }
};

/**
 * Obtener una tienda por ID.
 */
const getTiendaById = async (id) => {
  const tienda = await Tienda.findByPk(id);
  if (!tienda) {
    throwError("Tienda no encontrada", 404);
  }
  return tienda;
};

/**
 * Verificar si un nombre de tienda ya existe (para unicidad).
 */
const tiendaExists = async (nombre) => {
  const count = await Tienda.count({ where: { nombre } });
  return count > 0;
};

/**
 * Crear una nueva tienda.
 */
const createTienda = async (tiendaData) => {
  // Verificar que el nombre no esté en uso
  const exists = await tiendaExists(tiendaData.nombre);
  if (exists) {
    throwError(`El nombre de tienda "${tiendaData.nombre}" ya está en uso`, 400);
  }

  // Asegurar valores por defecto
  const data = {
    ...tiendaData,
    activo: tiendaData.activo !== undefined ? tiendaData.activo : true,
  };

  try {
    return await Tienda.create(data);
  } catch (error) {
    if (error.name === "SequelizeValidationError") {
      const messages = error.errors.map((e) => e.message);
      throwError("Error de validación", 400, messages);
    }
    if (error.status && error.errors) {
      throw error;
    }
    throwError(error.message || "Error al crear tienda", 500);
  }
};

/**
 * Actualizar una tienda existente.
 */
const updateTienda = async (id, tiendaData) => {
  const tienda = await Tienda.findByPk(id);
  if (!tienda) {
    throwError("Tienda no encontrada", 404);
  }

  // Si se actualiza el nombre, verificar que no esté en uso por otra tienda
  if (tiendaData.nombre && tiendaData.nombre !== tienda.nombre) {
    const exists = await tiendaExists(tiendaData.nombre);
    if (exists) {
      throwError(`El nombre de tienda "${tiendaData.nombre}" ya está en uso`, 400);
    }
  }

  try {
    await tienda.update(tiendaData);
    return tienda;
  } catch (error) {
    if (error.name === "SequelizeValidationError") {
      const messages = error.errors.map((e) => e.message);
      throwError("Error de validación", 400, messages);
    }
    if (error.status && error.errors) {
      throw error;
    }
    throwError(error.message || "Error al actualizar tienda", 500);
  }
};

/**
 * Eliminar una tienda (sin restricciones).
 */
const deleteTienda = async (id) => {
  const tienda = await Tienda.findByPk(id);
  if (!tienda) {
    throwError("Tienda no encontrada", 404);
  }
  await tienda.destroy();
  return true;
};

/**
 * Filtrar tiendas con paginación obligatoria.
 * @param {Object} filterCriteria - { nombre, tipo, activo }
 * @param {number} limit - Número de registros por página
 * @param {number} offset - Desplazamiento
 * @returns {Object} - { rows, count }
 */
const filterTiendas = async (filterCriteria = {}, limit = 10, offset = 0) => {
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
    order: [["id_tienda", "ASC"]],
    limit,
    offset,
  };

  const result = await Tienda.findAndCountAll(options);
  return result; // { rows, count }
};

module.exports = {
  getAllTiendas,
  getTiendaById,
  createTienda,
  updateTienda,
  deleteTienda,
  tiendaExists,
  filterTiendas,
};