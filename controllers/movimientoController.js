const movimientoService = require("../services/movimientoService");
const { throwError } = require("../helpers/errorLauncher");

const handleError = (res, error) => {
  const status = error.status || 500;
  const message = error.message || "Error interno del servidor";

  let errors = [];
  if (error.errors && Array.isArray(error.errors)) {
    errors = error.errors.map((e) => {
      if (typeof e === "string") return e;
      if (e.message) return e.message;
      if (e.msg) return e.msg;
      return String(e);
    });
  } else if (error.message) {
    errors = [error.message];
  } else {
    errors = ["Error interno del servidor"];
  }

  errors = errors.map((e) => (typeof e === "string" ? e : String(e)));
  res.status(status).json({ errors });
};

// ---------- GET by ID ----------
const getMovimientoById = async (req, res) => {
  try {
    const { id } = req.params;
    const movimiento = await movimientoService.getMovimientoById(id);
    res.status(200).json(movimiento);
  } catch (error) {
    handleError(res, error);
  }
};

// ---------- FILTER ----------
const filterMovimientos = async (req, res) => {
  try {
    const {
      limit,
      page,
      id_usuario,
      tipo_movimiento,
      estado,
      fecha_desde,
      fecha_hasta,
      id_servicio_tienda_origen,
      id_servicio_tienda_destino,
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
    if (id_usuario) {
      const val = parseInt(id_usuario, 10);
      if (isNaN(val) || val < 1) throwError("id_usuario debe ser un entero positivo.", 400);
      filters.id_usuario = val;
    }
    if (tipo_movimiento) filters.tipo_movimiento = tipo_movimiento.trim();
    if (estado !== undefined) {
      if (estado === "true") filters.estado = true;
      else if (estado === "false") filters.estado = false;
      else throwError("estado debe ser true o false.", 400);
    }
    if (fecha_desde) {
      const date = new Date(fecha_desde);
      if (isNaN(date.getTime())) throwError("Fecha desde inválida.", 400);
      filters.fecha_desde = date;
    }
    if (fecha_hasta) {
      const date = new Date(fecha_hasta);
      if (isNaN(date.getTime())) throwError("Fecha hasta inválida.", 400);
      filters.fecha_hasta = date;
    }
    if (id_servicio_tienda_origen) {
      const val = parseInt(id_servicio_tienda_origen, 10);
      if (isNaN(val) || val < 1) throwError("id_servicio_tienda_origen debe ser un entero positivo.", 400);
      filters.id_servicio_tienda_origen = val;
    }
    if (id_servicio_tienda_destino) {
      const val = parseInt(id_servicio_tienda_destino, 10);
      if (isNaN(val) || val < 1) throwError("id_servicio_tienda_destino debe ser un entero positivo.", 400);
      filters.id_servicio_tienda_destino = val;
    }

    const offset = (pageNum - 1) * limitNum;
    const { rows, count } = await movimientoService.filterMovimientos(filters, limitNum, offset);

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

// ---------- Helper: combinar IDs raíz con items de movimientos ----------
const buildMovimientosItems = (idOrigen, idDestino, movimientos) => {
  return movimientos.map((item) => ({
    id_servicio_tienda_origen: idOrigen,
    id_servicio_tienda_destino: idDestino,
    cantidad: item.cantidad,
    nota: item.nota || null,
  }));
};

// ---------- CREATE ----------
const createMovimiento = async (req, res) => {
  try {
    const {
      id_usuario,
      fecha_hora,
      tipo_movimiento,
      estado,
      nota,
      id_servicio_tienda_origen,
      id_servicio_tienda_destino,
      movimientos,
    } = req.body;

    const errors = [];
    if (!id_usuario) errors.push("id_usuario es obligatorio.");
    if (!tipo_movimiento || tipo_movimiento.trim() === "") errors.push("tipo_movimiento es obligatorio.");
    if (!id_servicio_tienda_origen) errors.push("id_servicio_tienda_origen es obligatorio.");
    if (!id_servicio_tienda_destino) errors.push("id_servicio_tienda_destino es obligatorio.");
    if (!movimientos || !Array.isArray(movimientos) || movimientos.length === 0) {
      errors.push("movimientos debe ser un arreglo no vacío.");
    }
    if (estado !== undefined && typeof estado !== "boolean") {
      errors.push("estado debe ser booleano (true/false).");
    }
    if (fecha_hora !== undefined) {
      const f = new Date(fecha_hora);
      if (isNaN(f.getTime())) errors.push("fecha_hora no es válida.");
    }
    if (nota !== undefined && nota !== null && nota.length > 255) {
      errors.push("nota no puede exceder 255 caracteres.");
    }

    if (errors.length > 0) {
      throwError("Datos inválidos", 400, errors);
    }

    // Construir los items aplicando los IDs raíz a cada uno
    const movimientosFull = buildMovimientosItems(
      id_servicio_tienda_origen,
      id_servicio_tienda_destino,
      movimientos
    );

    const data = {
      id_usuario,
      fecha_hora: fecha_hora ? new Date(fecha_hora) : new Date(),
      tipo_movimiento: tipo_movimiento.trim(),
      estado: estado !== undefined ? estado : true,
      nota: nota || null,
      movimientos: movimientosFull,
    };

    const newMovimiento = await movimientoService.createMovimiento(data);
    res.status(201).json({
      message: "Movimiento creado exitosamente",
      data: newMovimiento,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// ---------- UPDATE ----------
const updateMovimiento = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      id_usuario,
      fecha_hora,
      tipo_movimiento,
      estado,
      nota,
      id_servicio_tienda_origen,
      id_servicio_tienda_destino,
      movimientos,
    } = req.body;

    const errors = [];
    if (!id_usuario) errors.push("id_usuario es obligatorio.");
    if (!tipo_movimiento || tipo_movimiento.trim() === "") errors.push("tipo_movimiento es obligatorio.");
    if (!id_servicio_tienda_origen) errors.push("id_servicio_tienda_origen es obligatorio.");
    if (!id_servicio_tienda_destino) errors.push("id_servicio_tienda_destino es obligatorio.");
    if (!movimientos || !Array.isArray(movimientos) || movimientos.length === 0) {
      errors.push("movimientos debe ser un arreglo no vacío.");
    }
    if (estado !== undefined && typeof estado !== "boolean") {
      errors.push("estado debe ser booleano (true/false).");
    }
    if (fecha_hora !== undefined) {
      const f = new Date(fecha_hora);
      if (isNaN(f.getTime())) errors.push("fecha_hora no es válida.");
    }
    if (nota !== undefined && nota !== null && nota.length > 255) {
      errors.push("nota no puede exceder 255 caracteres.");
    }

    if (errors.length > 0) {
      throwError("Datos inválidos", 400, errors);
    }

    // Construir los items aplicando los IDs raíz a cada uno
    const movimientosFull = buildMovimientosItems(
      id_servicio_tienda_origen,
      id_servicio_tienda_destino,
      movimientos
    );

    const data = {
      id_usuario,
      fecha_hora: fecha_hora ? new Date(fecha_hora) : new Date(),
      tipo_movimiento: tipo_movimiento.trim(),
      estado: estado !== undefined ? estado : true,
      nota: nota || null,
      movimientos: movimientosFull,
    };

    const updated = await movimientoService.updateMovimiento(id, data);
    res.status(200).json({
      message: "Movimiento actualizado correctamente",
      data: updated,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// ---------- DELETE ----------
const deleteMovimiento = async (req, res) => {
  try {
    const { id } = req.params;
    await movimientoService.deleteMovimiento(id);
    res.status(200).json({ message: "Movimiento eliminado correctamente" });
  } catch (error) {
    handleError(res, error);
  }
};

module.exports = {
  getMovimientoById,
  filterMovimientos,
  createMovimiento,
  updateMovimiento,
  deleteMovimiento,
};