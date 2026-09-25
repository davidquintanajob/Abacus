const { Cliente } = require("../models/cliente");
const { ListaVenta } = require("../models/lista_venta");
const { Op } = require("sequelize");
const { throwError } = require("../helpers/errorLauncher");

// Validar si existe un cliente con el mismo teléfono
const telefonoExists = async (telefono, excludeId = null) => {
  if (!telefono) return false;
  const where = { telefono };
  if (excludeId) {
    where.id_cliente = { [Op.ne]: excludeId };
  }
  const count = await Cliente.count({ where });
  return count > 0;
};

const getClienteById = async (id) => {
  const cliente = await Cliente.findByPk(id, {
    include: [
      {
        model: ListaVenta,
        as: "listaVentas",
        required: false,
      },
    ],
  });
  if (!cliente) {
    throwError("Cliente no encontrado.", 404);
  }
  return cliente;
};

const createCliente = async (clienteData) => {
  // Validar teléfono único si se proporciona
  if (clienteData.telefono) {
    const exists = await telefonoExists(clienteData.telefono);
    if (exists) {
      throwError(`El teléfono "${clienteData.telefono}" ya está registrado por otro cliente.`, 400);
    }
  }

  try {
    const newCliente = await Cliente.create(clienteData);
    return newCliente;
  } catch (error) {
    if (error.name === "SequelizeValidationError") {
      const messages = error.errors.map((e) => e.message);
      throwError("Error de validación", 400, messages);
    }
    if (error.name === "SequelizeUniqueConstraintError") {
      throwError("El teléfono ya está en uso.", 400);
    }
    throwError(error.message || "Error al crear el cliente", 500);
  }
};

const updateCliente = async (id, updateData) => {
  const cliente = await Cliente.findByPk(id);
  if (!cliente) {
    throwError("Cliente no encontrado.", 404);
  }

  // Validar teléfono único si cambia
  if (updateData.telefono !== undefined && updateData.telefono !== cliente.telefono) {
    if (updateData.telefono) {
      const exists = await telefonoExists(updateData.telefono, id);
      if (exists) {
        throwError(`El teléfono "${updateData.telefono}" ya está registrado por otro cliente.`, 400);
      }
    }
  }

  try {
    await cliente.update(updateData);
    return await getClienteById(id);
  } catch (error) {
    if (error.name === "SequelizeValidationError") {
      const messages = error.errors.map((e) => e.message);
      throwError("Error de validación", 400, messages);
    }
    if (error.name === "SequelizeUniqueConstraintError") {
      throwError("El teléfono ya está en uso.", 400);
    }
    throwError(error.message || "Error al actualizar el cliente", 500);
  }
};

const deleteCliente = async (id) => {
  const cliente = await Cliente.findByPk(id);
  if (!cliente) {
    throwError("Cliente no encontrado.", 404);
  }

  // Al eliminar, las lista_venta asociadas quedan con id_cliente = NULL (SET NULL en el modelo)
  await cliente.destroy();
};

const filterClientes = async (filters, limit, offset) => {
  const where = {};

  if (filters.nombre) {
    where.nombre = { [Op.iLike]: `%${filters.nombre}%` };
  }
  if (filters.telefono) {
    where.telefono = { [Op.iLike]: `%${filters.telefono}%` };
  }
  if (filters.tipo_cliente) {
    where.tipo_cliente = { [Op.iLike]: `%${filters.tipo_cliente}%` };
  }

  const { rows, count } = await Cliente.findAndCountAll({
    where,
    order: [["nombre", "ASC"]],
    limit,
    offset,
    distinct: true,
  });

  return { rows, count };
};

module.exports = {
  getClienteById,
  createCliente,
  updateCliente,
  deleteCliente,
  filterClientes,
  telefonoExists,
};