const { Operacion } = require("../models/operacion");
const { Cuenta } = require("../models/cuenta");
const { Usuario } = require("../models/usuario");
const { Op, Sequelize } = require("sequelize");
const { throwError } = require("../helpers/errorLauncher");

// ---- Funciones auxiliares ----

const getMontoEnMonedaCuenta = (operacion, cuenta) => {
  return parseFloat(operacion.cantidad_operacion);
};

const actualizarFondoCuenta = async (cuentaId, delta, transaction) => {
  const options = { transaction };
  if (transaction) options.lock = transaction.LOCK.UPDATE;
  const cuenta = await Cuenta.findByPk(cuentaId, options);
  if (!cuenta) throwError("Cuenta no encontrada.", 404);
  const nuevoFondo = parseFloat(cuenta.fondo) + delta;
  if (nuevoFondo < 0) {
    throwError(`Fondos insuficientes en la cuenta "${cuenta.nombre}". Saldo actual: ${cuenta.fondo}`, 400);
  }
  await cuenta.update({ fondo: nuevoFondo }, { transaction });
  return cuenta;
};

// ---- Operaciones de una sola entidad ----

const createOperacion = async (operacionData, transaction = null) => {
  const { id_cuenta, id_usuario, cantidad_operacion, tipo_operacion, fecha_hora, motivo, cambio_moneda, is_check } = operacionData;

  // Validar usuario (si se envía)
  if (id_usuario) {
    const user = await Usuario.findByPk(id_usuario);
    if (!user) throwError("El usuario especificado no existe.", 404);
  }

  // Obtener cuenta y validar
  const cuenta = await Cuenta.findByPk(id_cuenta);
  if (!cuenta) throwError("La cuenta especificada no existe.", 404);

  const monto = parseFloat(cantidad_operacion);

  // Validar retiro: fondo suficiente
  if (tipo_operacion === "Retiro") {
    if (parseFloat(cuenta.fondo) < monto) {
      throwError(
        `No hay fondos suficientes en la cuenta "${cuenta.nombre}". Saldo: ${cuenta.fondo}, retiro solicitado: ${monto}`,
        400
      );
    }
  }

  const fecha = fecha_hora ? new Date(fecha_hora) : new Date();

  // Crear operación (sin afectar fondo aún)
  const newOperacion = await Operacion.create(
    {
      id_cuenta,
      id_usuario,
      cantidad_operacion,
      tipo_operacion,
      fecha_hora: fecha,
      motivo,
      cambio_moneda,
      is_check,
    },
    { transaction }
  );

  // Calcular delta para el fondo
  let delta = 0;
  if (tipo_operacion === "Ingreso" || tipo_operacion === "Ingreso por Venta") {
    delta = monto;
  } else if (tipo_operacion === "Retiro") {
    delta = -monto;
  }

  // Actualizar fondo de la cuenta
  await actualizarFondoCuenta(id_cuenta, delta, transaction);

  return newOperacion;
};

const getOperacionById = async (id) => {
  const operacion = await Operacion.findByPk(id, {
    include: [
      { model: Cuenta, as: "cuenta" },
      { model: Usuario, as: "usuario" },
    ],
  });
  if (!operacion) throwError("Operación no encontrada.", 404);
  return operacion;
};

const updateOperacion = async (id, updateData, transaction = null) => {
  if (!transaction) {
    const updateTransaction = await Operacion.sequelize.transaction();
    try {
      const updated = await updateOperacion(id, updateData, updateTransaction);
      await updateTransaction.commit();
      return updated;
    } catch (error) {
      if (!updateTransaction.finished) await updateTransaction.rollback();
      throw error;
    }
  }

  // Obtener la operación actual con su cuenta
  const operacion = await Operacion.findByPk(id, {
    include: [{ model: Cuenta, as: "cuenta" }],
    transaction,
  });
  if (!operacion) throwError("Operación no encontrada.", 404);

  // Obtener cuenta actual
  const cuentaActual = operacion.cuenta;
  const montoActual = getMontoEnMonedaCuenta(operacion, cuentaActual);

  let deltaActual = 0;
  if (operacion.tipo_operacion === "Ingreso" || operacion.tipo_operacion === "Ingreso por Venta") {
    deltaActual = montoActual;
  } else if (operacion.tipo_operacion === "Retiro") {
    deltaActual = -montoActual;
  }

  // Preparar nuevos datos (fusionar con los existentes)
  const newData = { ...operacion.get() };
  if (updateData.id_cuenta !== undefined) newData.id_cuenta = updateData.id_cuenta;
  if (updateData.id_usuario !== undefined) newData.id_usuario = updateData.id_usuario;
  if (updateData.cantidad_operacion !== undefined) newData.cantidad_operacion = updateData.cantidad_operacion;
  if (updateData.tipo_operacion !== undefined) newData.tipo_operacion = updateData.tipo_operacion;
  if (updateData.fecha_hora !== undefined) newData.fecha_hora = updateData.fecha_hora;
  if (updateData.motivo !== undefined) newData.motivo = updateData.motivo;
  if (updateData.cambio_moneda !== undefined) newData.cambio_moneda = updateData.cambio_moneda;
  if (updateData.is_check !== undefined) newData.is_check = updateData.is_check;

  // Validar nueva cuenta si cambia
  if (updateData.id_cuenta !== undefined && updateData.id_cuenta !== operacion.id_cuenta) {
    const cuenta = await Cuenta.findByPk(updateData.id_cuenta, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!cuenta) throwError("La nueva cuenta especificada no existe.", 404);
  }

  // Determinar nuevo monto
  const nuevoMonto = parseFloat(newData.cantidad_operacion);

  let deltaNuevo = 0;
  if (newData.tipo_operacion === "Ingreso" || newData.tipo_operacion === "Ingreso por Venta") {
    deltaNuevo = nuevoMonto;
  } else if (newData.tipo_operacion === "Retiro") {
    deltaNuevo = -nuevoMonto;
  }

  if (String(operacion.id_cuenta) === String(newData.id_cuenta)) {
    const delta = deltaNuevo - deltaActual;
    if (delta !== 0) {
      await actualizarFondoCuenta(operacion.id_cuenta, delta, transaction);
    }
  } else {
    if (deltaActual !== 0) {
      await actualizarFondoCuenta(operacion.id_cuenta, -deltaActual, transaction);
    }
    if (deltaNuevo !== 0) {
      await actualizarFondoCuenta(newData.id_cuenta, deltaNuevo, transaction);
    }
  }

  // Actualizar la operación
  await operacion.update(newData, { transaction });

  return await Operacion.findByPk(id, {
    include: [
      { model: Cuenta, as: "cuenta" },
      { model: Usuario, as: "usuario" },
    ],
    transaction,
  });
};

const deleteOperacion = async (id, transaction = null) => {
  const operacion = await Operacion.findByPk(id, {
    include: [{ model: Cuenta, as: "cuenta" }],
    transaction,
  });
  if (!operacion) throwError("Operación no encontrada.", 404);

  const cuenta = operacion.cuenta;
  const monto = getMontoEnMonedaCuenta(operacion, cuenta);

  // Revertir efecto
  let delta = 0;
  if (operacion.tipo_operacion === "Ingreso" || operacion.tipo_operacion === "Ingreso por Venta") {
    delta = -monto;
  } else if (operacion.tipo_operacion === "Retiro") {
    delta = monto;
  }
  if (delta !== 0) {
    await actualizarFondoCuenta(operacion.id_cuenta, delta, transaction);
  }

  await operacion.destroy({ transaction });
  return true;
};

// ---- Bulk operations ----

const createOperacionesBulk = async (operacionesData) => {
  if (!Array.isArray(operacionesData) || operacionesData.length === 0) {
    throwError("Lista de operaciones vacía.", 400);
  }

  const transaction = await Operacion.sequelize.transaction();
  try {
    const created = [];
    for (const data of operacionesData) {
      const newOp = await createOperacion(data, transaction);
      created.push(newOp);
    }
    await transaction.commit();

    // Obtener las operaciones con relaciones
    const ids = created.map(op => op.id_operacion);
    const ops = await Operacion.findAll({
      where: { id_operacion: { [Op.in]: ids } },
      include: [
        { model: Cuenta, as: "cuenta" },
        { model: Usuario, as: "usuario" },
      ],
      order: [["id_operacion", "ASC"]],
    });
    return ops;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const updateOperacionesBulk = async (updatesData) => {
  if (!Array.isArray(updatesData) || updatesData.length === 0) {
    throwError("Lista de actualizaciones vacía.", 400);
  }

  const transaction = await Operacion.sequelize.transaction();
  try {
    const updated = [];
    for (const update of updatesData) {
      const { id_operacion, ...rest } = update;
      const op = await updateOperacion(id_operacion, rest, transaction);
      updated.push(op);
    }
    await transaction.commit();

    const ids = updated.map(op => op.id_operacion);
    const ops = await Operacion.findAll({
      where: { id_operacion: { [Op.in]: ids } },
      include: [
        { model: Cuenta, as: "cuenta" },
        { model: Usuario, as: "usuario" },
      ],
      order: [["id_operacion", "ASC"]],
    });
    return ops;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// ---- Filtro con paginación y sumatorias ----

const filterOperaciones = async (filters, limit, offset) => {
  const where = {};
  const include = [
    { model: Cuenta, as: "cuenta" },
    { model: Usuario, as: "usuario" },
  ];

  // Filtros
  if (filters.nombre_cuenta) {
    include[0].where = {
      nombre: { [Op.iLike]: `%${filters.nombre_cuenta}%` },
    };
  }
  if (filters.nombre_usuario) {
    include[1].where = {
      nombre_natural: { [Op.iLike]: `%${filters.nombre_usuario}%` },
    };
  }
  if (filters.id_tienda !== undefined) {
    include[1].where = {
      ...(include[1].where || {}),
      id_tienda: filters.id_tienda,
    };
  }
  if (filters.tipo_operacion !== undefined) {
    where.tipo_operacion = filters.tipo_operacion === "Operaciones Manuales"
      ? { [Op.in]: ["Ingreso", "Retiro"] }
      : filters.tipo_operacion;
  }
  if (filters.is_check !== undefined) {
    where.is_check = filters.is_check;
  }
  if (filters.fecha_desde || filters.fecha_hasta) {
    where.fecha_hora = {};
    if (filters.fecha_desde) where.fecha_hora[Op.gte] = filters.fecha_desde;
    if (filters.fecha_hasta) {
      const end = new Date(filters.fecha_hasta);
      end.setDate(end.getDate() + 1);
      where.fecha_hora[Op.lt] = end;
    }
  }

  // Filtro de cantidad usando el monto único de la operación
  if (filters.cantidad_min !== undefined || filters.cantidad_max !== undefined) {
    const montoLiteral = Sequelize.col("Operacion.cantidad_operacion");
    if (filters.cantidad_min !== undefined) {
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push(Sequelize.where(montoLiteral, Op.gte, filters.cantidad_min));
    }
    if (filters.cantidad_max !== undefined) {
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push(Sequelize.where(montoLiteral, Op.lte, filters.cantidad_max));
    }
  }

  // Consulta paginada
  const paginationOptions = limit === undefined ? {} : { limit, offset };
  const { rows, count } = await Operacion.findAndCountAll({
    where,
    include,
    order: [["fecha_hora", "DESC"]],
    ...paginationOptions,
    distinct: true,
  });

  // Calcular sumatorias globales (todas las operaciones que cumplen el filtro)
  // Repetimos la consulta pero sin limit/offset
  const allOps = await Operacion.findAll({
    where,
    include,
    order: [["fecha_hora", "DESC"]],
    distinct: true,
  });

  const summary = {
    totalIngresoEfectivoCUP: 0,
    totalIngresoVentaEfectivoCUP: 0,
    totalRetiroEfectivoCUP: 0,
    totalIngresoTransferenciaCUP: 0,
    totalIngresoVentaTransferenciaCUP: 0,
    totalRetiroTransferenciaCUP: 0,
    totalIngresoEfectivoUSD: 0,
    totalIngresoVentaEfectivoUSD: 0,
    totalRetiroEfectivoUSD: 0,
    totalIngresoTransferenciaUSD: 0,
    totalIngresoVentaTransferenciaUSD: 0,
    totalRetiroTransferenciaUSD: 0,
  };

  const summaryKeyByAccountType = {
    "Efectivo CUP": {
      Ingreso: "totalIngresoEfectivoCUP",
      "Ingreso por Venta": "totalIngresoVentaEfectivoCUP",
      Retiro: "totalRetiroEfectivoCUP",
    },
    "Transferencia CUP": {
      Ingreso: "totalIngresoTransferenciaCUP",
      "Ingreso por Venta": "totalIngresoVentaTransferenciaCUP",
      Retiro: "totalRetiroTransferenciaCUP",
    },
    "Efectivo USD": {
      Ingreso: "totalIngresoEfectivoUSD",
      "Ingreso por Venta": "totalIngresoVentaEfectivoUSD",
      Retiro: "totalRetiroEfectivoUSD",
    },
    "Transferencia USD": {
      Ingreso: "totalIngresoTransferenciaUSD",
      "Ingreso por Venta": "totalIngresoVentaTransferenciaUSD",
      Retiro: "totalRetiroTransferenciaUSD",
    },
  };

  for (const op of allOps) {
    const cuenta = op.cuenta;
    const summaryKey = cuenta && summaryKeyByAccountType[cuenta.tipo_cuenta]?.[op.tipo_operacion];
    if (summaryKey) {
      summary[summaryKey] += getMontoEnMonedaCuenta(op, cuenta);
    }
  }

  return { rows, count, summary };
};

module.exports = {
  createOperacion,
  getOperacionById,
  updateOperacion,
  deleteOperacion,
  createOperacionesBulk,
  updateOperacionesBulk,
  filterOperaciones,
};