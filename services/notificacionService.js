const { Op } = require("sequelize");
const sequelize = require("../helpers/database");
const { Usuario } = require("../models/usuario");
const { Tienda } = require("../models/tienda");
const { Notificacion } = require("../models/notificacion");
const { throwError } = require("../helpers/errorLauncher");
const { emitToUser } = require("../helpers/socket");

const resolveTargetUserIds = async ({ id_tienda, id_usuarios }, transaction) => {
  const hasStore = id_tienda !== undefined;
  const hasUsers = id_usuarios !== undefined;
  if (hasStore === hasUsers) {
    throwError("Debe proporcionar id_tienda o id_usuarios, pero no ambos", 400);
  }

  if (hasStore) {
    const storeId = Number(id_tienda);
    if (!Number.isInteger(storeId) || storeId < 1) {
      throwError("id_tienda debe ser un entero positivo", 400);
    }
    const store = await Tienda.findByPk(storeId, { transaction });
    if (!store) {
      throwError(`La tienda con id ${storeId} no existe`, 404);
    }
    const users = await Usuario.findAll({
      attributes: ["id_usuario"],
      where: { id_tienda: storeId },
      transaction,
    });
    if (users.length === 0) {
      throwError(`La tienda con id ${storeId} no tiene usuarios`, 400);
    }
    return users.map(user => user.id_usuario);
  }

  if (!Array.isArray(id_usuarios) || id_usuarios.length === 0) {
    throwError("id_usuarios debe ser una lista no vacía de IDs", 400);
  }
  const userIds = [...new Set(id_usuarios.map(Number))];
  if (userIds.some(id => !Number.isInteger(id) || id < 1)) {
    throwError("Todos los elementos de id_usuarios deben ser enteros positivos", 400);
  }

  const users = await Usuario.findAll({
    attributes: ["id_usuario"],
    where: { id_usuario: { [Op.in]: userIds } },
    transaction,
  });
  const existingIds = new Set(users.map(user => String(user.id_usuario)));
  const missingIds = userIds.filter(id => !existingIds.has(String(id)));
  if (missingIds.length > 0) {
    throwError(`No existen los siguientes usuarios: ${missingIds.join(", ")}`, 400);
  }

  return userIds;
};

const handleValidationError = (error) => {
  if (error.name === "SequelizeValidationError") {
    throwError("Error de validación", 400, error.errors.map(item => item.message));
  }
  throw error;
};

const createNotifications = async ({ id_tienda, id_usuarios, notificationData }) => {
  const transaction = await sequelize.transaction();
  let notifications;
  try {
    const userIds = await resolveTargetUserIds({ id_tienda, id_usuarios }, transaction);
    notifications = await Notificacion.bulkCreate(
      userIds.map(id_usuario => ({
        ...notificationData,
        id_usuario,
        is_read: false,
      })),
      { transaction, validate: true }
    );
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    handleValidationError(error);
  }

  const data = notifications.map(notification => notification.get({ plain: true }));
  for (const notification of data) {
    emitToUser(notification.id_usuario, "notification:new", notification);
  }
  return data;
};

const updateNotifications = async ({ id_tienda, id_usuarios, updateData }) => {
  const transaction = await sequelize.transaction();
  let notifications;
  try {
    const userIds = await resolveTargetUserIds({ id_tienda, id_usuarios }, transaction);
    notifications = await Notificacion.findAll({
      where: { id_usuario: { [Op.in]: userIds } },
      transaction,
    });
    if (notifications.length === 0) {
      throwError("No se encontraron notificaciones para los usuarios seleccionados", 404);
    }

    for (const notification of notifications) {
      await notification.update(updateData, { transaction, validate: true });
    }
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    handleValidationError(error);
  }

  const data = notifications.map(notification => notification.get({ plain: true }));
  for (const notification of data) {
    emitToUser(notification.id_usuario, "notification:updated", notification);
  }
  return data;
};

const parseDateFilter = (value, parameter, endOfDay = false) => {
  if (typeof value !== "string" || !value.trim()) {
    throwError(`${parameter} debe ser una fecha válida`, 400);
  }
  const input = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const date = new Date(`${input}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input) {
      throwError(`${parameter} debe ser una fecha válida`, 400);
    }
    if (endOfDay) date.setUTCHours(23, 59, 59, 999);
    return date;
  }

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throwError(`${parameter} debe ser una fecha válida`, 400);
  }
  return date;
};

const filterNotifications = async (filters, limit, offset) => {
  const where = {};
  if (filters.id_usuario !== undefined) where.id_usuario = filters.id_usuario;
  if (filters.tipo) where.tipo = filters.tipo;
  if (filters.titulo) where.titulo = { [Op.iLike]: `%${filters.titulo}%` };

  if (filters.fecha_desde || filters.fecha_hasta) {
    const dateRange = {};
    if (filters.fecha_desde) {
      dateRange[Op.gte] = parseDateFilter(filters.fecha_desde, "fecha_desde");
    }
    if (filters.fecha_hasta) {
      dateRange[Op.lte] = parseDateFilter(filters.fecha_hasta, "fecha_hasta", true);
    }
    if (dateRange[Op.gte] && dateRange[Op.lte] && dateRange[Op.gte] > dateRange[Op.lte]) {
      throwError("fecha_desde debe ser anterior o igual a fecha_hasta", 400);
    }
    where.fecha_hora = dateRange;
  }

  return Notificacion.findAndCountAll({
    where,
    order: [["fecha_hora", "DESC"], ["id_notificacion", "DESC"]],
    limit,
    offset,
  });
};

module.exports = {
  createNotifications,
  updateNotifications,
  filterNotifications,
};
