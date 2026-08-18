const { Cuenta } = require("../models/cuenta");
const { Op } = require("sequelize");
const { throwError } = require("../helpers/errorLauncher");
const { tiposCuenta } = require("../models/cuenta");

// Verificar si existe una cuenta con el mismo nombre
const cuentaExistsByName = async (nombre, excludeId = null) => {
  const where = { nombre };
  if (excludeId) {
    where.id_cuenta = { [Op.ne]: excludeId };
  }
  const count = await Cuenta.count({ where });
  return count > 0;
};

// Verificar si existe una cuenta con el mismo número de cuenta (si se proporciona)
const cuentaExistsByNum = async (num_cuenta, excludeId = null) => {
  if (!num_cuenta) return false;
  const where = { num_cuenta };
  if (excludeId) {
    where.id_cuenta = { [Op.ne]: excludeId };
  }
  const count = await Cuenta.count({ where });
  return count > 0;
};

const getCuentaById = async (id) => {
  const cuenta = await Cuenta.findByPk(id);
  if (!cuenta) {
    throwError("Cuenta no encontrada.", 404);
  }
  return cuenta;
};

const createCuenta = async (cuentaData) => {
  // Validar nombre único
  const exists = await cuentaExistsByName(cuentaData.nombre);
  if (exists) {
    throwError(`Ya existe una cuenta con el nombre "${cuentaData.nombre}".`, 400);
  }

  // Validar número de cuenta único si se proporciona
  if (cuentaData.num_cuenta) {
    const existsNum = await cuentaExistsByNum(cuentaData.num_cuenta);
    if (existsNum) {
      throwError(`El número de cuenta "${cuentaData.num_cuenta}" ya está en uso.`, 400);
    }
  }

  // 🔒 IMPORTANTE: El campo "fondo" no se puede asignar al crear una cuenta.
  // Se ignora cualquier valor enviado y se usa el valor por defecto (0).
  const dataToCreate = {
    nombre: cuentaData.nombre,
    tipo_cuenta: cuentaData.tipo_cuenta,
    num_cuenta: cuentaData.num_cuenta || null,
    nota: cuentaData.nota || null,
    // fondo se deja con defaultValue: 0
  };

  try {
    const newCuenta = await Cuenta.create(dataToCreate);
    return newCuenta;
  } catch (error) {
    if (error.name === "SequelizeValidationError") {
      const messages = error.errors.map((e) => e.message);
      throwError("Error de validación", 400, messages);
    }
    throwError(error.message || "Error al crear la cuenta", 500);
  }
};

const updateCuenta = async (id, updateData) => {
  const cuenta = await getCuentaById(id);

  // Validar nombre único (si cambia)
  if (updateData.nombre && updateData.nombre !== cuenta.nombre) {
    const exists = await cuentaExistsByName(updateData.nombre, id);
    if (exists) {
      throwError(`Ya existe una cuenta con el nombre "${updateData.nombre}".`, 400);
    }
  }

  // Validar número de cuenta único (si cambia y se proporciona)
  if (updateData.num_cuenta !== undefined && updateData.num_cuenta !== cuenta.num_cuenta) {
    if (updateData.num_cuenta) {
      const existsNum = await cuentaExistsByNum(updateData.num_cuenta, id);
      if (existsNum) {
        throwError(`El número de cuenta "${updateData.num_cuenta}" ya está en uso.`, 400);
      }
    }
  }

  // 🔒 IMPORTANTE: El campo "fondo" no se puede modificar a través de este endpoint.
  // Si se intenta enviar, se ignora (o se podría lanzar error).
  // Aquí lo eliminamos del objeto para asegurar que no se actualice.
  delete updateData.fondo;

  try {
    await cuenta.update(updateData);
    return await getCuentaById(id);
  } catch (error) {
    if (error.name === "SequelizeValidationError") {
      const messages = error.errors.map((e) => e.message);
      throwError("Error de validación", 400, messages);
    }
    throwError(error.message || "Error al actualizar la cuenta", 500);
  }
};

const deleteCuenta = async (id) => {
  const cuenta = await getCuentaById(id);

  try {
    await cuenta.destroy();
  } catch (error) {
    if (error.name === "SequelizeForeignKeyConstraintError") {
      throwError(
        "No se puede eliminar la cuenta porque tiene operaciones asociadas. Elimine las operaciones primero.",
        400
      );
    }
    throw error;
  }
};

const filterCuentas = async (filters = {}, limit = 10, offset = 0) => {
  const where = {};

  if (filters.nombre) {
    where.nombre = { [Op.iLike]: `%${filters.nombre}%` };
  }
  if (filters.tipo_cuenta) {
    where.tipo_cuenta = filters.tipo_cuenta;
  }
  if (filters.num_cuenta) {
    where.num_cuenta = { [Op.iLike]: `%${filters.num_cuenta}%` };
  }

  const result = await Cuenta.findAndCountAll({
    where,
    order: [["nombre", "ASC"]],
    limit,
    offset,
  });

  return result; // { rows, count }
};

module.exports = {
  createCuenta,
  getCuentaById,
  updateCuenta,
  deleteCuenta,
  filterCuentas,
  cuentaExistsByName,
  cuentaExistsByNum,
};