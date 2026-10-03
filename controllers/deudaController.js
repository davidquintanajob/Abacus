const deudaService = require("../services/deudaService");
const { throwError } = require("../helpers/errorLauncher");

const handleError = (res, error) => {
  const status = error.status || 500;
  const message = error.message || "Error interno del servidor";
  let errors = error.errors;
  if (!Array.isArray(errors) || errors.length === 0) {
    errors = [message];
  }
  errors = errors.map((e) => (typeof e === "string" ? e : String(e)));
  res.status(status).json({ errors });
};

const getDeudaById = async (req, res) => {
  try {
    const { id } = req.params;
    const deuda = await deudaService.getDeudaById(id);
    res.status(200).json(deuda);
  } catch (error) {
    handleError(res, error);
  }
};

const createDeuda = async (req, res) => {
  try {
    const {
      fecha_hora,
      monto_cup,
      monto_usd,
      cambio_moneda,
      id_cliente,
      id_lista_venta,
      pago_deuda,
    } = req.body;

    const errors = [];

    if (id_cliente === undefined || id_cliente === null) {
      errors.push("id_cliente es obligatorio.");
    }
    if (monto_cup === undefined || monto_cup === null || isNaN(monto_cup) || monto_cup < 0) {
      errors.push("monto_cup es obligatorio y debe ser un número no negativo.");
    }
    if (monto_usd === undefined || monto_usd === null || isNaN(monto_usd) || monto_usd < 0) {
      errors.push("monto_usd es obligatorio y debe ser un número no negativo.");
    }
    if (cambio_moneda === undefined || cambio_moneda === null || isNaN(cambio_moneda) || cambio_moneda <= 0) {
      errors.push("cambio_moneda es obligatorio y debe ser mayor que cero.");
    }
    if (fecha_hora !== undefined) {
      const f = new Date(fecha_hora);
      if (isNaN(f.getTime())) errors.push("fecha_hora no es válida.");
    }

    if (pago_deuda) {
      const { cantidad_pagada, forma_pago, id_cuenta_operacion, id_usuario } = pago_deuda;

      if (cantidad_pagada === undefined || cantidad_pagada === null || isNaN(cantidad_pagada) || cantidad_pagada <= 0) {
        errors.push("pago_deuda.cantidad_pagada debe ser un número mayor que cero.");
      }
      if (!forma_pago || !["Efectivo CUP", "Transferencia CUP", "Efectivo USD", "Transferencia USD"].includes(forma_pago)) {
        errors.push("pago_deuda.forma_pago debe ser uno de: Efectivo CUP, Transferencia CUP, Efectivo USD, Transferencia USD.");
      }
      if (!id_cuenta_operacion || isNaN(id_cuenta_operacion) || id_cuenta_operacion <= 0) {
        errors.push("pago_deuda.id_cuenta_operacion es obligatorio y debe ser un entero positivo.");
      }
      if (id_usuario !== undefined && (isNaN(id_usuario) || id_usuario <= 0)) {
        errors.push("pago_deuda.id_usuario debe ser un entero positivo si se envía.");
      }
    }

    if (errors.length > 0) {
      throwError("Datos inválidos", 400, errors);
    }

    const deudaData = {
      fecha_hora: fecha_hora ? new Date(fecha_hora) : new Date(),
      monto_cup,
      monto_usd,
      cambio_moneda,
      id_cliente,
      id_lista_venta: id_lista_venta || null,
    };

    const idUsuario =
      (pago_deuda && pago_deuda.id_usuario) ||
      req.user?.id_usuario ||
      req.user?.userId ||
      null;

    const newDeuda = await deudaService.createDeuda(deudaData, pago_deuda, idUsuario);
    res.status(201).json({
      message: "Deuda creada exitosamente",
      data: newDeuda,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// ---------- UPDATE ----------
const updateDeuda = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fecha_hora,
      monto_cup,
      monto_usd,
      cambio_moneda,
      id_cliente,
      id_lista_venta,
      pagos,
    } = req.body;

    if (Object.keys(req.body).length === 0) {
      throwError("Se debe proporcionar al menos un campo para actualizar.", 400);
    }

    const errors = [];

    if (monto_cup !== undefined && (isNaN(monto_cup) || monto_cup < 0)) {
      errors.push("monto_cup debe ser un número no negativo.");
    }
    if (monto_usd !== undefined && (isNaN(monto_usd) || monto_usd < 0)) {
      errors.push("monto_usd debe ser un número no negativo.");
    }
    if (cambio_moneda !== undefined && (isNaN(cambio_moneda) || cambio_moneda <= 0)) {
      errors.push("cambio_moneda debe ser mayor que cero.");
    }
    if (fecha_hora !== undefined) {
      const f = new Date(fecha_hora);
      if (isNaN(f.getTime())) errors.push("fecha_hora no es válida.");
    }
    if (id_cliente !== undefined && (isNaN(id_cliente) || id_cliente <= 0)) {
      errors.push("id_cliente debe ser un entero positivo.");
    }

    // Validar pagos si se envía
    if (pagos !== undefined) {
      if (!Array.isArray(pagos)) {
        errors.push("pagos debe ser un arreglo.");
      } else {
        pagos.forEach((pago, index) => {
          if (!pago || typeof pago !== "object") {
            errors.push(`Pago ${index + 1}: objeto inválido.`);
            return;
          }
          if (pago.cantidad_pagada === undefined || pago.cantidad_pagada === null || isNaN(pago.cantidad_pagada) || pago.cantidad_pagada <= 0) {
            errors.push(`Pago ${index + 1}: cantidad_pagada debe ser un número mayor que cero.`);
          }
          if (!pago.forma_pago || !["Efectivo CUP", "Transferencia CUP", "Efectivo USD", "Transferencia USD"].includes(pago.forma_pago)) {
            errors.push(`Pago ${index + 1}: forma_pago inválida.`);
          }
          if (!pago.id_cuenta_operacion || isNaN(pago.id_cuenta_operacion) || pago.id_cuenta_operacion <= 0) {
            errors.push(`Pago ${index + 1}: id_cuenta_operacion es obligatorio.`);
          }
          if (pago.fecha_hora !== undefined) {
            const f = new Date(pago.fecha_hora);
            if (isNaN(f.getTime())) errors.push(`Pago ${index + 1}: fecha_hora inválida.`);
          }
          if (pago.id_usuario !== undefined && (isNaN(pago.id_usuario) || pago.id_usuario <= 0)) {
            errors.push(`Pago ${index + 1}: id_usuario debe ser un entero positivo si se envía.`);
          }
        });
      }
    }

    if (errors.length > 0) {
      throwError("Datos inválidos", 400, errors);
    }

    const deudaData = {};
    if (fecha_hora !== undefined) deudaData.fecha_hora = fecha_hora;
    if (monto_cup !== undefined) deudaData.monto_cup = monto_cup;
    if (monto_usd !== undefined) deudaData.monto_usd = monto_usd;
    if (cambio_moneda !== undefined) deudaData.cambio_moneda = cambio_moneda;
    if (id_cliente !== undefined) deudaData.id_cliente = id_cliente;
    if (id_lista_venta !== undefined) deudaData.id_lista_venta = id_lista_venta;

    const idUsuarioDefault = req.user?.id_usuario || req.user?.userId || null;

    const updated = await deudaService.updateDeuda(id, deudaData, pagos, idUsuarioDefault);
    res.status(200).json({
      message: "Deuda actualizada correctamente",
      data: updated,
    });
  } catch (error) {
    handleError(res, error);
  }
};

const saldarDeuda = async (req, res) => {
  try {
    const { id } = req.params;
    const { pagos } = req.body;

    if (!Array.isArray(pagos) || pagos.length === 0) {
      throwError("El campo 'pagos' debe ser un arreglo no vacío.", 400);
    }

    const errors = [];
    pagos.forEach((pago, index) => {
      if (!pago || typeof pago !== "object") {
        errors.push(`Pago ${index + 1}: objeto inválido.`);
        return;
      }
      if (pago.cantidad_pagada === undefined || pago.cantidad_pagada === null || isNaN(pago.cantidad_pagada) || pago.cantidad_pagada <= 0) {
        errors.push(`Pago ${index + 1}: cantidad_pagada debe ser un número mayor que cero.`);
      }
      if (!pago.forma_pago || !["Efectivo CUP", "Transferencia CUP", "Efectivo USD", "Transferencia USD"].includes(pago.forma_pago)) {
        errors.push(`Pago ${index + 1}: forma_pago inválida.`);
      }
      if (!pago.id_cuenta_operacion || isNaN(pago.id_cuenta_operacion) || pago.id_cuenta_operacion <= 0) {
        errors.push(`Pago ${index + 1}: id_cuenta_operacion es obligatorio.`);
      }
      if (pago.fecha_hora !== undefined) {
        const f = new Date(pago.fecha_hora);
        if (isNaN(f.getTime())) errors.push(`Pago ${index + 1}: fecha_hora inválida.`);
      }
      if (pago.id_usuario !== undefined && (isNaN(pago.id_usuario) || pago.id_usuario <= 0)) {
        errors.push(`Pago ${index + 1}: id_usuario debe ser un entero positivo si se envía.`);
      }
    });

    if (errors.length > 0) {
      throwError("Datos inválidos", 400, errors);
    }

    const idUsuarioDefault = req.user?.id_usuario || req.user?.userId || null;

    const result = await deudaService.saldarDeuda(id, pagos, idUsuarioDefault);
    res.status(200).json({
      message: "Pagos registrados correctamente",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

const deleteDeuda = async (req, res) => {
  try {
    const { id } = req.params;
    await deudaService.deleteDeuda(id);
    res.status(200).json({ message: "Deuda eliminada correctamente" });
  } catch (error) {
    handleError(res, error);
  }
};

const filterDeudas = async (req, res) => {
  try {
    const {
      limit,
      page,
      id_cliente,
      nombre_cliente,
      telefono_cliente,
      fecha_desde,
      fecha_hasta,
      monto_cup_min,
      monto_cup_max,
      monto_usd_min,
      monto_usd_max,
      tiene_deuda,
    } = req.query;

    let limitNum = parseInt(limit, 10) || 10;
    if (isNaN(limitNum) || limitNum < 1) {
      throwError("El parámetro 'limit' debe ser un número entero positivo.", 400);
    }
    let pageNum = parseInt(page, 10) || 1;
    if (isNaN(pageNum) || pageNum < 1) {
      throwError("El parámetro 'page' debe ser un número entero positivo.", 400);
    }

    const filters = {};

    if (id_cliente !== undefined) {
      const parsed = parseInt(id_cliente, 10);
      if (isNaN(parsed) || parsed < 1) throwError("id_cliente debe ser un entero positivo.", 400);
      filters.id_cliente = parsed;
    }
    if (nombre_cliente) filters.nombre_cliente = nombre_cliente.trim();
    if (telefono_cliente) filters.telefono_cliente = telefono_cliente.trim();

    if (fecha_desde) {
      const date = new Date(fecha_desde);
      if (isNaN(date.getTime())) throwError("Fecha desde inválida (formato YYYY-MM-DD).", 400);
      filters.fecha_desde = date;
    }
    if (fecha_hasta) {
      const date = new Date(fecha_hasta);
      if (isNaN(date.getTime())) throwError("Fecha hasta inválida (formato YYYY-MM-DD).", 400);
      filters.fecha_hasta = date;
    }

    if (monto_cup_min !== undefined) {
      const val = parseFloat(monto_cup_min);
      if (isNaN(val) || val < 0) throwError("monto_cup_min debe ser un número no negativo.", 400);
      filters.monto_cup_min = val;
    }
    if (monto_cup_max !== undefined) {
      const val = parseFloat(monto_cup_max);
      if (isNaN(val) || val < 0) throwError("monto_cup_max debe ser un número no negativo.", 400);
      filters.monto_cup_max = val;
    }
    if (filters.monto_cup_min !== undefined && filters.monto_cup_max !== undefined && filters.monto_cup_min > filters.monto_cup_max) {
      throwError("monto_cup_min no puede ser mayor que monto_cup_max.", 400);
    }

    if (monto_usd_min !== undefined) {
      const val = parseFloat(monto_usd_min);
      if (isNaN(val) || val < 0) throwError("monto_usd_min debe ser un número no negativo.", 400);
      filters.monto_usd_min = val;
    }
    if (monto_usd_max !== undefined) {
      const val = parseFloat(monto_usd_max);
      if (isNaN(val) || val < 0) throwError("monto_usd_max debe ser un número no negativo.", 400);
      filters.monto_usd_max = val;
    }
    if (filters.monto_usd_min !== undefined && filters.monto_usd_max !== undefined && filters.monto_usd_min > filters.monto_usd_max) {
      throwError("monto_usd_min no puede ser mayor que monto_usd_max.", 400);
    }

    if (tiene_deuda !== undefined) {
      if (tiene_deuda === "true") filters.tiene_deuda = true;
      else if (tiene_deuda === "false") filters.tiene_deuda = false;
      else throwError("El parámetro 'tiene_deuda' debe ser true o false.", 400);
    }

    const offset = (pageNum - 1) * limitNum;
    const { rows, count } = await deudaService.filterDeudas(filters, limitNum, offset);

    res.status(200).json({
      data: rows,
      pagination: {
        currentPage: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
        totalItems: count,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};

module.exports = {
  getDeudaById,
  createDeuda,
  updateDeuda,
  saldarDeuda,
  deleteDeuda,
  filterDeudas,
};