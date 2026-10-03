const { Cliente } = require("../models/cliente");
const { ListaVenta } = require("../models/lista_venta");
const { Deuda } = require("../models/deuda");
const { PagoDeuda } = require("../models/pago_deuda");
const { Operacion } = require("../models/operacion");
const { Cuenta } = require("../models/cuenta");
const { Usuario } = require("../models/usuario");
const { Op } = require("sequelize");
const { throwError } = require("../helpers/errorLauncher");

// ===== CONSTANTES =====
const TIPOS_CUENTA_VALIDOS = ["Efectivo CUP", "Transferencia CUP", "Efectivo USD", "Transferencia USD"];

// ===== HELPERS =====

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

// Validar que una cuenta exista y su tipo corresponda a la forma de pago
const validateCuentaParaFormaPago = async (id_cuenta, forma_pago, transaction = null) => {
  if (!id_cuenta) {
    throwError("id_cuenta_operacion es obligatorio para registrar un pago.", 400);
  }
  const cuenta = await Cuenta.findByPk(id_cuenta, { transaction });
  if (!cuenta) {
    throwError(`La cuenta con id ${id_cuenta} no existe.`, 404);
  }
  if (cuenta.tipo_cuenta !== forma_pago) {
    throwError(
      `La cuenta con id ${id_cuenta} debe ser de tipo "${forma_pago}". Tipo actual: "${cuenta.tipo_cuenta}".`,
      400
    );
  }
  return cuenta;
};

// Validar que un usuario exista
const validateUsuarioExists = async (id_usuario, transaction = null) => {
  if (!id_usuario) return null;
  const usuario = await Usuario.findByPk(id_usuario, { transaction });
  if (!usuario) {
    throwError(`El usuario con id ${id_usuario} no existe.`, 404);
  }
  return usuario;
};

// Actualizar fondo de cuenta (suma o resta)
const actualizarFondoCuenta = async (cuenta, delta, transaction) => {
  const nuevoFondo = parseFloat(cuenta.fondo) + delta;
  if (nuevoFondo < 0) {
    throwError(`Fondos insuficientes en la cuenta "${cuenta.nombre}". Saldo actual: ${cuenta.fondo}`, 400);
  }
  await cuenta.update({ fondo: nuevoFondo }, { transaction });
  return cuenta;
};

/**
 * Registra un pago de deuda:
 * 1. Valida datos y deuda.
 * 2. Valida la cuenta (tipo = forma_pago) y el usuario.
 * 3. Crea la Operacion de tipo "Pago de deuda".
 * 4. Crea el PagoDeuda asociado a la Deuda y a la Operacion.
 * 5. Resta cantidad_pagada del monto_restante correspondiente.
 * 6. Actualiza el fondo de la cuenta.
 */
const registrarPagoDeuda = async (pagoData, clienteNombre, id_usuario, transaction) => {
  const {
    id_deuda,
    fecha_hora,
    cantidad_pagada,
    forma_pago,
    cambio_moneda,
    id_cuenta_operacion,
  } = pagoData || {};

  if (!id_deuda) {
    throwError("El campo id_deuda es obligatorio para registrar un pago.", 400);
  }
  if (cantidad_pagada === undefined || cantidad_pagada === null || isNaN(cantidad_pagada) || cantidad_pagada <= 0) {
    throwError("El campo cantidad_pagada es obligatorio y debe ser mayor que cero.", 400);
  }
  if (!forma_pago || !TIPOS_CUENTA_VALIDOS.includes(forma_pago)) {
    throwError(`forma_pago debe ser uno de: ${TIPOS_CUENTA_VALIDOS.join(", ")}`, 400);
  }

  const deuda = await Deuda.findByPk(id_deuda, { transaction });
  if (!deuda) {
    throwError("Deuda no encontrada.", 404);
  }

  const cuenta = await validateCuentaParaFormaPago(id_cuenta_operacion, forma_pago, transaction);
  await validateUsuarioExists(id_usuario, transaction);

  const esCup = forma_pago === "Efectivo CUP" || forma_pago === "Transferencia CUP";
  const esUsd = forma_pago === "Efectivo USD" || forma_pago === "Transferencia USD";

  // Validar saldo suficiente
  if (esCup && parseFloat(deuda.monto_restante_cup) < cantidad_pagada) {
    throwError(
      `El monto restante en CUP (${deuda.monto_restante_cup}) es insuficiente para este pago de ${cantidad_pagada}.`,
      400
    );
  }
  if (esUsd && parseFloat(deuda.monto_restante_usd) < cantidad_pagada) {
    throwError(
      `El monto restante en USD (${deuda.monto_restante_usd}) es insuficiente para este pago de ${cantidad_pagada}.`,
      400
    );
  }

  const fecha = fecha_hora ? new Date(fecha_hora) : new Date();
  const cambio = cambio_moneda || deuda.cambio_moneda;

  // 1) Crear la Operacion PRIMERO (porque PagoDeuda requiere id_operacion)
  const operacion = await Operacion.create(
    {
      id_cuenta: cuenta.id_cuenta,
      id_usuario: id_usuario || null,
      id_lista_venta: null,
      cantidad_operacion: cantidad_pagada,
      tipo_operacion: "Pago de deuda",
      fecha_hora: fecha,
      motivo: `Pago de deuda del cliente (${clienteNombre})`,
      cambio_moneda: cambio,
    },
    { transaction }
  );

  // 2) Crear el PagoDeuda asociado a la deuda y a la operación
  const nuevoPago = await PagoDeuda.create(
    {
      fecha_hora: fecha,
      cantidad_pagada,
      forma_pago,
      cambio_moneda: cambio,
      id_deuda,
      id_operacion: operacion.id_operacion,
    },
    { transaction }
  );

  // 3) Actualizar monto_restante de la deuda
  if (esCup) {
    await deuda.update(
      { monto_restante_cup: parseFloat(deuda.monto_restante_cup) - cantidad_pagada },
      { transaction }
    );
  } else {
    await deuda.update(
      { monto_restante_usd: parseFloat(deuda.monto_restante_usd) - cantidad_pagada },
      { transaction }
    );
  }

  // 4) Actualizar el fondo de la cuenta
  await actualizarFondoCuenta(cuenta, cantidad_pagada, transaction);

  return nuevoPago;
};

/**
 * Crea una nueva deuda con un pago inicial opcional (recibiendo deudaData y pagoData por separado).
 */
const crearDeudaConPagoOpcional = async (deudaData, pagoData, id_cliente, clienteNombre, id_usuario, transaction) => {
  const {
    fecha_hora,
    monto_cup,
    monto_usd,
    cambio_moneda,
    id_lista_venta,
  } = deudaData || {};

  // Validaciones obligatorias de la deuda
  if (monto_cup === undefined || monto_cup === null || isNaN(monto_cup) || monto_cup < 0) {
    throwError("El campo monto_cup es obligatorio y debe ser un número no negativo.", 400);
  }
  if (monto_usd === undefined || monto_usd === null || isNaN(monto_usd) || monto_usd < 0) {
    throwError("El campo monto_usd es obligatorio y debe ser un número no negativo.", 400);
  }
  if (cambio_moneda === undefined || cambio_moneda === null || isNaN(cambio_moneda) || cambio_moneda <= 0) {
    throwError("El campo cambio_moneda es obligatorio y debe ser mayor que cero.", 400);
  }

  // Crear la deuda
  const nuevaDeuda = await Deuda.create(
    {
      fecha_hora: fecha_hora ? new Date(fecha_hora) : new Date(),
      monto_cup,
      monto_usd,
      monto_restante_cup: monto_cup,
      monto_restante_usd: monto_usd,
      cambio_moneda,
      id_cliente,
      id_lista_venta: id_lista_venta || null,
    },
    { transaction }
  );

  // Si se envió pago_deuda, registrarlo
  if (pagoData && pagoData.cantidad_pagada !== undefined && pagoData.cantidad_pagada !== null) {
    await registrarPagoDeuda(
      {
        id_deuda: nuevaDeuda.id_deuda,
        fecha_hora: pagoData.fecha_hora || fecha_hora || new Date(),
        cantidad_pagada: pagoData.cantidad_pagada,
        forma_pago: pagoData.forma_pago,
        cambio_moneda: pagoData.cambio_moneda || cambio_moneda,
        id_cuenta_operacion: pagoData.id_cuenta_operacion,
      },
      clienteNombre,
      id_usuario,
      transaction
    );
  }

  return nuevaDeuda;
};

// ===== FUNCIONES PRINCIPALES =====

// Include estándar de deudas con pagos (y su operación) y lista de venta
const getDeudasInclude = () => ({
  model: Deuda,
  as: "deudas",
  required: false,
  include: [
    {
      model: PagoDeuda,
      as: "pagos",
      required: false,
      include: [
        {
          model: Operacion,
          as: "operacion",
          required: false,
        },
      ],
    },
    {
      model: ListaVenta,
      as: "listaVenta",
      required: false,
    },
  ],
});

const getClienteById = async (id) => {
  const cliente = await Cliente.findByPk(id, {
    include: [getDeudasInclude()],
  });
  if (!cliente) {
    throwError("Cliente no encontrado.", 404);
  }
  return cliente;
};

const createCliente = async (clienteData, deudaData, pagoData, id_usuario) => {
  // Validar teléfono único si se proporciona
  if (clienteData.telefono) {
    const exists = await telefonoExists(clienteData.telefono);
    if (exists) {
      throwError(`El teléfono "${clienteData.telefono}" ya está registrado por otro cliente.`, 400);
    }
  }

  const transaction = await Cliente.sequelize.transaction();

  try {
    const newCliente = await Cliente.create(clienteData, { transaction });

    // Si se envió información de deuda, crearla junto con el pago opcional
    if (deudaData) {
      await crearDeudaConPagoOpcional(
        deudaData,
        pagoData,
        newCliente.id_cliente,
        newCliente.nombre,
        id_usuario,
        transaction
      );
    }

    await transaction.commit();
    return await getClienteById(newCliente.id_cliente);
  } catch (error) {
    await transaction.rollback();
    if (error.name === "SequelizeValidationError") {
      const messages = error.errors.map((e) => e.message);
      throwError("Error de validación", 400, messages);
    }
    if (error.name === "SequelizeUniqueConstraintError") {
      throwError("El teléfono ya está en uso.", 400);
    }
    if (error.status && error.errors) throw error;
    throwError(error.message || "Error al crear el cliente", 500);
  }
};

/**
 * Actualiza SOLO los datos propios del cliente.
 * No interactúa con deudas ni pagos.
 */
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
    if (Object.keys(updateData).length > 0) {
      await cliente.update(updateData);
    }
    return await getClienteById(id);
  } catch (error) {
    if (error.name === "SequelizeValidationError") {
      const messages = error.errors.map((e) => e.message);
      throwError("Error de validación", 400, messages);
    }
    if (error.name === "SequelizeUniqueConstraintError") {
      throwError("El teléfono ya está en uso.", 400);
    }
    if (error.status && error.errors) throw error;
    throwError(error.message || "Error al actualizar el cliente", 500);
  }
};

const deleteCliente = async (id) => {
  const cliente = await Cliente.findByPk(id);
  if (!cliente) {
    throwError("Cliente no encontrado.", 404);
  }

  // Verificar si tiene deudas pendientes; si las tiene, impedir la eliminación
  const deudaPendiente = await Deuda.findOne({
    where: {
      id_cliente: id,
      [Op.or]: [
        { monto_restante_cup: { [Op.ne]: 0 } },
        { monto_restante_usd: { [Op.ne]: 0 } },
      ],
    },
  });
  if (deudaPendiente) {
    throwError(
      "No se puede eliminar el cliente porque tiene deudas pendientes. Liquide las deudas primero.",
      400
    );
  }

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
  if (filters.direccion) {
    where.direccion = { [Op.iLike]: `%${filters.direccion}%` };
  }
  if (filters.tipo_cliente) {
    where.tipo_cliente = { [Op.iLike]: `%${filters.tipo_cliente}%` };
  }

  // Filtro por tiene_deuda
  if (filters.tiene_deuda !== undefined) {
    const deudasConSaldo = await Deuda.findAll({
      attributes: ["id_cliente"],
      where: {
        [Op.or]: [
          { monto_restante_cup: { [Op.ne]: 0 } },
          { monto_restante_usd: { [Op.ne]: 0 } },
        ],
      },
      group: ["id_cliente"],
      raw: true,
    });
    const idsConDeuda = deudasConSaldo.map((d) => d.id_cliente);

    if (filters.tiene_deuda === true) {
      if (idsConDeuda.length === 0) {
        return { rows: [], count: 0 };
      }
      where.id_cliente = { [Op.in]: idsConDeuda };
    } else {
      if (idsConDeuda.length > 0) {
        where.id_cliente = { [Op.notIn]: idsConDeuda };
      }
    }
  }

  const { rows, count } = await Cliente.findAndCountAll({
    where,
    order: [["nombre", "ASC"]],
    limit,
    offset,
    distinct: true,
    include: [getDeudasInclude()],
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