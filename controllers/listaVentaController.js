const listaVentaService = require("../services/listaVentaService");
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

const getListaVentaById = async (req, res) => {
  try {
    const { id } = req.params;
    const lista = await listaVentaService.getListaVentaById(id);
    res.status(200).json(lista);
  } catch (error) {
    handleError(res, error);
  }
};

const filterListaVentas = async (req, res) => {
  try {
    const {
      limit,
      page,
      fecha_desde,
      fecha_hasta,
      nota,
      cantidad_min,
      cantidad_max,
      forma_cobro,
      nombre_usuario,
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
    if (fecha_desde) {
      const date = new Date(fecha_desde);
      if (isNaN(date.getTime())) throwError("Fecha desde inválida (formato YYYY-MM-DD)", 400);
      filters.fecha_desde = date;
    }
    if (fecha_hasta) {
      const date = new Date(fecha_hasta);
      if (isNaN(date.getTime())) throwError("Fecha hasta inválida (formato YYYY-MM-DD)", 400);
      filters.fecha_hasta = date;
    }
    if (nota) filters.nota = nota.trim();
    if (cantidad_min !== undefined) {
      const val = parseFloat(cantidad_min);
      if (isNaN(val) || val < 0) throwError("cantidad_min debe ser un número no negativo.", 400);
      filters.cantidad_min = val;
    }
    if (cantidad_max !== undefined) {
      const val = parseFloat(cantidad_max);
      if (isNaN(val) || val < 0) throwError("cantidad_max debe ser un número no negativo.", 400);
      filters.cantidad_max = val;
    }
    if (filters.cantidad_min !== undefined && filters.cantidad_max !== undefined && filters.cantidad_min > filters.cantidad_max) {
      throwError("cantidad_min no puede ser mayor que cantidad_max.", 400);
    }
    if (forma_cobro) {
      const formasValidas = ["Efectivo CUP", "Efectivo USD", "Transferencia CUP", "Transferencia USD"];
      if (!formasValidas.includes(forma_cobro)) {
        throwError(`forma_cobro debe ser uno de: ${formasValidas.join(", ")}`, 400);
      }
      filters.forma_cobro = forma_cobro;
    }
    if (nombre_usuario) filters.nombre_usuario = nombre_usuario.trim();

    const offset = (pageNum - 1) * limitNum;
    const result = await listaVentaService.filterListaVentas(filters, limitNum, offset);

    res.status(200).json({
      data: result.rows,
      pagination: {
        currentPage: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(result.count / limitNum),
        totalItems: result.count,
      },
      summary: result.summary,
    });
  } catch (error) {
    handleError(res, error);
  }
};

const createListaVenta = async (req, res) => {
  try {
    const {
      fecha_hora,
      nota,
      cantidad_cobrada_efectivo_cup = 0,
      cantidad_cobrada_efectivo_usd = 0,
      cantidad_cobrada_transferencia_cup = 0,
      cantidad_cobrada_transferencia_usd = 0,
      id_cuenta_efectivo_cup,
      id_cuenta_efectivo_usd,
      id_cuenta_transferencia_cup,
      id_cuenta_transferencia_usd,
      id_usuario,
      cambio_moneda,
      ventas,
    } = req.body;

    const errors = [];
    if (!fecha_hora) errors.push("fecha_hora es obligatorio.");
    if (!ventas || !Array.isArray(ventas) || ventas.length === 0) {
      errors.push("ventas debe ser un arreglo no vacío.");
    }
    if (!id_usuario) errors.push("id_usuario es obligatorio.");
    if (cambio_moneda === undefined || cambio_moneda === null) errors.push("cambio_moneda es obligatorio.");
    if (isNaN(cambio_moneda) || cambio_moneda <= 0) errors.push("cambio_moneda debe ser mayor que cero.");

    // Validar que los montos no sean negativos
    const montos = [
      cantidad_cobrada_efectivo_cup,
      cantidad_cobrada_efectivo_usd,
      cantidad_cobrada_transferencia_cup,
      cantidad_cobrada_transferencia_usd,
    ];
    for (const m of montos) {
      if (isNaN(m) || m < 0) {
        errors.push("Las cantidades cobradas no pueden ser negativas.");
        break;
      }
    }

    // Validar cuentas: si cantidad > 0, la cuenta correspondiente debe existir y ser enviada
    const cuentasMap = {
      cantidad_cobrada_efectivo_cup: id_cuenta_efectivo_cup,
      cantidad_cobrada_efectivo_usd: id_cuenta_efectivo_usd,
      cantidad_cobrada_transferencia_cup: id_cuenta_transferencia_cup,
      cantidad_cobrada_transferencia_usd: id_cuenta_transferencia_usd,
    };
    for (const [key, val] of Object.entries(cuentasMap)) {
      const cantidad = req.body[key];
      if (cantidad && cantidad > 0) {
        if (!val || isNaN(val) || val <= 0) {
          errors.push(`Se requiere id_cuenta para ${key} porque su cantidad es > 0.`);
        }
      }
    }

    if (errors.length > 0) {
      throwError("Datos inválidos", 400, errors);
    }

    const listaData = {
      fecha_hora: new Date(fecha_hora),
      nota: nota || null,
      cantidad_cobrada_efectivo_cup,
      cantidad_cobrada_efectivo_usd,
      cantidad_cobrada_transferencia_cup,
      cantidad_cobrada_transferencia_usd,
      id_cuenta_efectivo_cup,
      id_cuenta_efectivo_usd,
      id_cuenta_transferencia_cup,
      id_cuenta_transferencia_usd,
      id_usuario,
      cambio_moneda,
      ventas,
    };

    const newLista = await listaVentaService.createListaVenta(listaData);
    res.status(201).json({
      message: "Lista de ventas creada exitosamente",
      data: newLista,
    });
  } catch (error) {
    handleError(res, error);
  }
};

const deleteListaVenta = async (req, res) => {
  try {
    const { id } = req.params;
    await listaVentaService.deleteListaVenta(id);
    res.status(200).json({ message: "Lista de ventas eliminada correctamente" });
  } catch (error) {
    handleError(res, error);
  }
};

module.exports = {
  getListaVentaById,
  filterListaVentas,
  createListaVenta,
  deleteListaVenta,
};