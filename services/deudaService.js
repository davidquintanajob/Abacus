const { Deuda } = require("../models/deuda");
const { PagoDeuda } = require("../models/pago_deuda");
const { Cliente } = require("../models/cliente");
const { ListaVenta } = require("../models/lista_venta");
const { Venta } = require("../models/venta");
const { ServicioTienda } = require("../models/servicio_tienda");
const { Servicio } = require("../models/servicio");
const { Producto } = require("../models/producto");
const { Tienda } = require("../models/tienda");
const { Operacion } = require("../models/operacion");
const { Cuenta } = require("../models/cuenta");
const { Usuario } = require("../models/usuario");
const { Op } = require("sequelize");
const { throwError } = require("../helpers/errorLauncher");

// ===== CONSTANTES =====
const TIPOS_CUENTA_VALIDOS = ["Efectivo CUP", "Transferencia CUP", "Efectivo USD", "Transferencia USD"];

// ===== HELPERS =====

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

const validateUsuarioExists = async (id_usuario, transaction = null) => {
  if (!id_usuario) return null;
  const usuario = await Usuario.findByPk(id_usuario, { transaction });
  if (!usuario) {
    throwError(`El usuario con id ${id_usuario} no existe.`, 404);
  }
  return usuario;
};

const validateClienteExists = async (id_cliente, transaction = null) => {
  const cliente = await Cliente.findByPk(id_cliente, { transaction });
  if (!cliente) {
    throwError(`El cliente con id ${id_cliente} no existe.`, 404);
  }
  return cliente;
};

const validateListaVentaExists = async (id_lista_venta, transaction = null) => {
  if (!id_lista_venta) return null;
  const lista = await ListaVenta.findByPk(id_lista_venta, { transaction });
  if (!lista) {
    throwError(`La lista de venta con id ${id_lista_venta} no existe.`, 404);
  }
  return lista;
};

const actualizarFondoCuenta = async (cuenta, delta, transaction) => {
  const nuevoFondo = parseFloat(cuenta.fondo) + delta;
  if (nuevoFondo < 0) {
    throwError(`Fondos insuficientes en la cuenta "${cuenta.nombre}". Saldo actual: ${cuenta.fondo}`, 400);
  }
  await cuenta.update({ fondo: nuevoFondo }, { transaction });
  return cuenta;
};

/**
 * Registra un pago sobre una deuda existente.
 */
const registrarPagoDeuda = async (pagoData, deuda, clienteNombre, id_usuario, transaction) => {
  const {
    fecha_hora,
    cantidad_pagada,
    forma_pago,
    cambio_moneda,
    id_cuenta_operacion,
  } = pagoData || {};

  if (cantidad_pagada === undefined || cantidad_pagada === null || isNaN(cantidad_pagada) || cantidad_pagada <= 0) {
    throwError("cantidad_pagada es obligatorio y debe ser mayor que cero.", 400);
  }
  if (!forma_pago || !TIPOS_CUENTA_VALIDOS.includes(forma_pago)) {
    throwError(`forma_pago debe ser uno de: ${TIPOS_CUENTA_VALIDOS.join(", ")}`, 400);
  }

  const cuenta = await validateCuentaParaFormaPago(id_cuenta_operacion, forma_pago, transaction);
  await validateUsuarioExists(id_usuario, transaction);

  const esCup = forma_pago === "Efectivo CUP" || forma_pago === "Transferencia CUP";
  const esUsd = forma_pago === "Efectivo USD" || forma_pago === "Transferencia USD";

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

  const nuevoPago = await PagoDeuda.create(
    {
      fecha_hora: fecha,
      cantidad_pagada,
      forma_pago,
      cambio_moneda: cambio,
      id_deuda: deuda.id_deuda,
      id_operacion: operacion.id_operacion,
    },
    { transaction }
  );

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

  await actualizarFondoCuenta(cuenta, cantidad_pagada, transaction);

  return nuevoPago;
};

/**
 * Revierte todos los pagos de una deuda:
 * - Por cada pago, resta de la cuenta la cantidad pagada (validando primero que no quede negativa).
 * - Elimina los pagos y sus operaciones asociadas.
 * Devuelve la lista de operaciones y cuentas afectadas para referencia.
 */
const revertirPagosDeDeuda = async (pagos, transaction) => {
  // Primera pasada: validar que ninguna cuenta quede con saldo negativo
  for (const pago of pagos) {
    if (pago.operacion) {
      const cuenta = await Cuenta.findByPk(pago.operacion.id_cuenta, { transaction });
      if (cuenta) {
        const nuevoFondo = parseFloat(cuenta.fondo) - parseFloat(pago.operacion.cantidad_operacion);
        if (nuevoFondo < 0) {
          throwError(
            `No se puede realizar la operación: la cuenta "${cuenta.nombre}" quedaría con saldo negativo (${nuevoFondo.toFixed(5)}) al revertir un pago.`,
            400
          );
        }
      }
    }
  }

  // Segunda pasada: aplicar la reversión
  for (const pago of pagos) {
    if (pago.operacion) {
      const cuenta = await Cuenta.findByPk(pago.operacion.id_cuenta, { transaction });
      if (cuenta) {
        await actualizarFondoCuenta(cuenta, -parseFloat(pago.operacion.cantidad_operacion), transaction);
      }
    }
  }

  // Recolectar ids de operaciones para eliminar
  const operacionIds = pagos
    .filter((p) => p.operacion)
    .map((p) => p.operacion.id_operacion);

  // Eliminar los pagos primero (FK RESTRICT con operacion)
  for (const pago of pagos) {
    await pago.destroy({ transaction });
  }

  // Eliminar las operaciones
  if (operacionIds.length > 0) {
    await Operacion.destroy({ where: { id_operacion: { [Op.in]: operacionIds } }, transaction });
  }
};

// ===== INCLUDE ESTÁNDAR =====
const getDeudaInclude = () => [
  { model: Cliente, as: "cliente", required: false },
  {
    model: PagoDeuda,
    as: "pagos",
    required: false,
    include: [
      { model: Operacion, as: "operacion", required: false },
    ],
  },
  {
    model: ListaVenta,
    as: "listaVenta",
    required: false,
    include: [
      {
        model: Venta,
        as: "ventas",
        required: false,
        include: [
          {
            model: ServicioTienda,
            as: "servicioTienda",
            required: false,
            include: [
              { model: Servicio, as: "servicio", include: [{ model: Producto, as: "producto" }] },
              { model: Tienda, as: "tienda" },
            ],
          },
        ],
      },
    ],
  },
];

// ===== FUNCIONES PRINCIPALES =====

const getDeudaById = async (id) => {
  const deuda = await Deuda.findByPk(id, {
    include: getDeudaInclude(),
  });
  if (!deuda) {
    throwError("Deuda no encontrada.", 404);
  }
  return deuda;
};

const createDeuda = async (deudaData, pagoData, id_usuario) => {
  const {
    fecha_hora,
    monto_cup,
    monto_usd,
    cambio_moneda,
    id_cliente,
    id_lista_venta,
  } = deudaData;

  const transaction = await Deuda.sequelize.transaction();

  try {
    const cliente = await validateClienteExists(id_cliente, transaction);
    await validateListaVentaExists(id_lista_venta, transaction);

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

    if (pagoData && pagoData.cantidad_pagada !== undefined && pagoData.cantidad_pagada !== null) {
      await registrarPagoDeuda(
        {
          fecha_hora: pagoData.fecha_hora || fecha_hora || new Date(),
          cantidad_pagada: pagoData.cantidad_pagada,
          forma_pago: pagoData.forma_pago,
          cambio_moneda: pagoData.cambio_moneda || cambio_moneda,
          id_cuenta_operacion: pagoData.id_cuenta_operacion,
        },
        nuevaDeuda,
        cliente.nombre,
        id_usuario,
        transaction
      );
    }

    await transaction.commit();
    return await getDeudaById(nuevaDeuda.id_deuda);
  } catch (error) {
    await transaction.rollback();
    if (error.name === "SequelizeValidationError") {
      const messages = error.errors.map((e) => e.message);
      throwError("Error de validación", 400, messages);
    }
    if (error.status && error.errors) throw error;
    throwError(error.message || "Error al crear la deuda", 500);
  }
};

/**
 * Actualiza una deuda y opcionalmente su lista de pagos.
 * - Si `pagos` está definido: se reemplaza la lista completa (revierte anteriores, crea nuevos).
 * - Si `pagos` no está definido: solo se actualizan los campos de la deuda y se recalcula monto_restante.
 */
const updateDeuda = async (id, deudaData, pagos, id_usuario_default) => {
  const transaction = await Deuda.sequelize.transaction();

  try {
    const deuda = await Deuda.findByPk(id, {
      include: [
        {
          model: PagoDeuda,
          as: "pagos",
          include: [{ model: Operacion, as: "operacion" }],
        },
        { model: Cliente, as: "cliente" },
      ],
      transaction,
    });
    if (!deuda) {
      throwError("Deuda no encontrada.", 404);
    }

    let clienteNombre = deuda.cliente ? deuda.cliente.nombre : "Desconocido";

    const reemplazarPagos = Array.isArray(pagos);

    // 1) Si vamos a reemplazar los pagos, revertir los existentes
    if (reemplazarPagos) {
      await revertirPagosDeDeuda(deuda.pagos, transaction);
    }

    // 2) Validar nuevo cliente si cambia
    if (deudaData.id_cliente !== undefined && deudaData.id_cliente !== deuda.id_cliente) {
      const cliente = await validateClienteExists(deudaData.id_cliente, transaction);
      clienteNombre = cliente.nombre;
    }

    // 3) Validar lista_venta si cambia
    if (deudaData.id_lista_venta !== undefined) {
      await validateListaVentaExists(deudaData.id_lista_venta, transaction);
    }

    // 4) Calcular nuevos montos
    const nuevosMontoCup = deudaData.monto_cup !== undefined ? deudaData.monto_cup : parseFloat(deuda.monto_cup);
    const nuevosMontoUsd = deudaData.monto_usd !== undefined ? deudaData.monto_usd : parseFloat(deuda.monto_usd);

    const updateFields = {
      monto_cup: nuevosMontoCup,
      monto_usd: nuevosMontoUsd,
    };

    if (deudaData.fecha_hora !== undefined) updateFields.fecha_hora = new Date(deudaData.fecha_hora);
    if (deudaData.cambio_moneda !== undefined) updateFields.cambio_moneda = deudaData.cambio_moneda;
    if (deudaData.id_cliente !== undefined) updateFields.id_cliente = deudaData.id_cliente;
    if (deudaData.id_lista_venta !== undefined) updateFields.id_lista_venta = deudaData.id_lista_venta;

    if (reemplazarPagos) {
      // Resetear montos restantes al monto completo
      updateFields.monto_restante_cup = nuevosMontoCup;
      updateFields.monto_restante_usd = nuevosMontoUsd;
    } else {
      // Recalcular monto_restante en base a pagos existentes
      let totalPagadoCup = 0;
      let totalPagadoUsd = 0;
      for (const pago of deuda.pagos) {
        const esCup = pago.forma_pago === "Efectivo CUP" || pago.forma_pago === "Transferencia CUP";
        if (esCup) totalPagadoCup += parseFloat(pago.cantidad_pagada);
        else totalPagadoUsd += parseFloat(pago.cantidad_pagada);
      }

      const nuevoRestanteCup = nuevosMontoCup - totalPagadoCup;
      const nuevoRestanteUsd = nuevosMontoUsd - totalPagadoUsd;

      if (nuevoRestanteCup < 0) {
        throwError(
          `El nuevo monto_cup (${nuevosMontoCup}) es menor que el total ya pagado en CUP (${totalPagadoCup}).`,
          400
        );
      }
      if (nuevoRestanteUsd < 0) {
        throwError(
          `El nuevo monto_usd (${nuevosMontoUsd}) es menor que el total ya pagado en USD (${totalPagadoUsd}).`,
          400
        );
      }

      updateFields.monto_restante_cup = nuevoRestanteCup;
      updateFields.monto_restante_usd = nuevoRestanteUsd;
    }

    await deuda.update(updateFields, { transaction });

    // 5) Si se reemplazan los pagos, crear los nuevos
    if (reemplazarPagos && pagos.length > 0) {
      await deuda.reload({ transaction });
      for (const pago of pagos) {
        const idUsuario = pago.id_usuario || id_usuario_default || null;
        await registrarPagoDeuda(
          {
            fecha_hora: pago.fecha_hora,
            cantidad_pagada: pago.cantidad_pagada,
            forma_pago: pago.forma_pago,
            cambio_moneda: pago.cambio_moneda,
            id_cuenta_operacion: pago.id_cuenta_operacion,
          },
          deuda,
          clienteNombre,
          idUsuario,
          transaction
        );
      }
    }

    await transaction.commit();
    return await getDeudaById(id);
  } catch (error) {
    await transaction.rollback();
    if (error.name === "SequelizeValidationError") {
      const messages = error.errors.map((e) => e.message);
      throwError("Error de validación", 400, messages);
    }
    if (error.status && error.errors) throw error;
    throwError(error.message || "Error al actualizar la deuda", 500);
  }
};

const saldarDeuda = async (id, pagos, id_usuario_default) => {
  const transaction = await Deuda.sequelize.transaction();

  try {
    const deuda = await Deuda.findByPk(id, {
      include: [{ model: Cliente, as: "cliente" }],
      transaction,
    });
    if (!deuda) {
      throwError("Deuda no encontrada.", 404);
    }

    const clienteNombre = deuda.cliente ? deuda.cliente.nombre : "Desconocido";

    for (const pago of pagos) {
      const idUsuario = pago.id_usuario || id_usuario_default || null;
      await deuda.reload({ transaction });

      await registrarPagoDeuda(
        {
          fecha_hora: pago.fecha_hora,
          cantidad_pagada: pago.cantidad_pagada,
          forma_pago: pago.forma_pago,
          cambio_moneda: pago.cambio_moneda,
          id_cuenta_operacion: pago.id_cuenta_operacion,
        },
        deuda,
        clienteNombre,
        idUsuario,
        transaction
      );
    }

    await transaction.commit();
    return await getDeudaById(id);
  } catch (error) {
    await transaction.rollback();
    if (error.name === "SequelizeValidationError") {
      const messages = error.errors.map((e) => e.message);
      throwError("Error de validación", 400, messages);
    }
    if (error.status && error.errors) throw error;
    throwError(error.message || "Error al saldar la deuda", 500);
  }
};

/**
 * Elimina una deuda aunque tenga pagos o no esté saldada.
 * Revierte cada pago (resta del fondo de la cuenta) y elimina pagos y operaciones en cascada.
 */
const deleteDeuda = async (id) => {
  const transaction = await Deuda.sequelize.transaction();

  try {
    const deuda = await Deuda.findByPk(id, {
      include: [
        {
          model: PagoDeuda,
          as: "pagos",
          include: [{ model: Operacion, as: "operacion" }],
        },
      ],
      transaction,
    });
    if (!deuda) {
      throwError("Deuda no encontrada.", 404);
    }

    // Revertir todos los pagos (valida fondos y elimina pago_deuda + operaciones)
    await revertirPagosDeDeuda(deuda.pagos, transaction);

    // Eliminar la deuda
    await deuda.destroy({ transaction });

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    if (error.name === "SequelizeValidationError") {
      const messages = error.errors.map((e) => e.message);
      throwError("Error de validación", 400, messages);
    }
    if (error.status && error.errors) throw error;
    throwError(error.message || "Error al eliminar la deuda", 500);
  }
};

const filterDeudas = async (filters, limit, offset) => {
  const where = {};

  if (filters.id_cliente !== undefined) {
    where.id_cliente = filters.id_cliente;
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

  if (filters.monto_cup_min !== undefined || filters.monto_cup_max !== undefined) {
    where.monto_cup = {};
    if (filters.monto_cup_min !== undefined) where.monto_cup[Op.gte] = filters.monto_cup_min;
    if (filters.monto_cup_max !== undefined) where.monto_cup[Op.lte] = filters.monto_cup_max;
  }

  if (filters.monto_usd_min !== undefined || filters.monto_usd_max !== undefined) {
    where.monto_usd = {};
    if (filters.monto_usd_min !== undefined) where.monto_usd[Op.gte] = filters.monto_usd_min;
    if (filters.monto_usd_max !== undefined) where.monto_usd[Op.lte] = filters.monto_usd_max;
  }

  if (filters.tiene_deuda !== undefined) {
    if (filters.tiene_deuda === true) {
      where[Op.or] = [
        { monto_restante_cup: { [Op.ne]: 0 } },
        { monto_restante_usd: { [Op.ne]: 0 } },
      ];
    } else {
      where[Op.and] = [
        { monto_restante_cup: { [Op.eq]: 0 } },
        { monto_restante_usd: { [Op.eq]: 0 } },
      ];
    }
  }

  const include = getDeudaInclude();

  if (filters.nombre_cliente || filters.telefono_cliente) {
    const clienteInclude = include.find((i) => i.as === "cliente");
    if (clienteInclude) {
      clienteInclude.required = true;
      clienteInclude.where = {};
      if (filters.nombre_cliente) {
        clienteInclude.where.nombre = { [Op.iLike]: `%${filters.nombre_cliente}%` };
      }
      if (filters.telefono_cliente) {
        clienteInclude.where.telefono = { [Op.iLike]: `%${filters.telefono_cliente}%` };
      }
    }
  }

  const { rows, count } = await Deuda.findAndCountAll({
    where,
    include,
    order: [["fecha_hora", "DESC"]],
    limit,
    offset,
    distinct: true,
  });

  return { rows, count };
};

module.exports = {
  getDeudaById,
  createDeuda,
  updateDeuda,
  saldarDeuda,
  deleteDeuda,
  filterDeudas,
};