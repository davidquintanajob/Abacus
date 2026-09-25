const salidaService = require("../services/salidaService");
const { throwError } = require("../helpers/errorLauncher");

const handleError = (res, error) => {
  const status = error.status || 500;
  const message = error.message || "Error interno del servidor";

  let errors = [];
  if (error.errors && Array.isArray(error.errors)) {
    // Intentar extraer mensajes de cada error (para errores de Sequelize)
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

  // Si el mensaje es un objeto vacío o [object Object], reemplazamos
  errors = errors.map((e) => (typeof e === "string" ? e : String(e)));

  res.status(status).json({ errors });
};

const createSalida = async (req, res) => {
  try {
    const { id_servicio_tienda, cantidad_total, descripcion, tipo_salida, fecha, id_usuario } = req.body;
    const usuarioId = id_usuario || req.user.id_usuario;

    const errors = [];
    if (!id_servicio_tienda) errors.push("El campo id_servicio_tienda es obligatorio.");
    if (!cantidad_total && cantidad_total !== 0) errors.push("La cantidad total es obligatoria.");
    if (cantidad_total !== undefined && (isNaN(cantidad_total) || cantidad_total <= 0)) {
      errors.push("La cantidad total debe ser un número mayor que cero.");
    }
    if (!descripcion || descripcion.trim() === "") errors.push("La descripción es obligatoria.");
    if (descripcion && descripcion.length > 255) errors.push("La descripción no puede exceder 255 caracteres.");
    if (!tipo_salida || tipo_salida.trim() === "") errors.push("El tipo de salida es obligatorio.");
    if (tipo_salida && tipo_salida.length > 50) errors.push("El tipo de salida no puede exceder 50 caracteres.");
    if (id_usuario !== undefined && (isNaN(id_usuario) || id_usuario <= 0)) {
      errors.push("El ID de usuario debe ser un número entero positivo.");
    }
    if (fecha !== undefined) {
      const fechaObj = new Date(fecha);
      if (isNaN(fechaObj.getTime())) errors.push("La fecha proporcionada no es válida.");
    }

    if (errors.length > 0) {
      throwError("Datos inválidos", 400, errors);
    }

    const salidaData = {
      id_servicio_tienda,
      cantidad_total,
      descripcion: descripcion.trim(),
      tipo_salida: tipo_salida.trim(),
      fecha: fecha || null,
      id_usuario: usuarioId,
    };

    const newSalida = await salidaService.createSalida(salidaData);
    res.status(201).json({
      message: "Salida creada exitosamente",
      data: newSalida,
    });
  } catch (error) {
    handleError(res, error);
  }
};

const getSalidaById = async (req, res) => {
  try {
    const { id } = req.params;
    const salida = await salidaService.getSalidaById(id);
    res.status(200).json(salida);
  } catch (error) {
    handleError(res, error);
  }
};

const updateSalida = async (req, res) => {
  try {
    const { id } = req.params;
    const { id_servicio_tienda, cantidad_total, descripcion, tipo_salida, fecha, id_usuario } = req.body;

    if (Object.keys(req.body).length === 0) {
      throwError("Se debe proporcionar al menos un campo para actualizar", 400);
    }

    const errors = [];
    if (id_servicio_tienda !== undefined && (isNaN(id_servicio_tienda) || id_servicio_tienda <= 0)) {
      errors.push("El ID de servicio-tienda debe ser un número entero positivo.");
    }
    if (cantidad_total !== undefined) {
      if (isNaN(cantidad_total) || cantidad_total <= 0) {
        errors.push("La cantidad total debe ser un número mayor que cero.");
      }
    }
    if (descripcion !== undefined) {
      if (descripcion.trim() === "") errors.push("La descripción no puede estar vacía.");
      if (descripcion.length > 255) errors.push("La descripción no puede exceder 255 caracteres.");
    }
    if (tipo_salida !== undefined) {
      if (tipo_salida.trim() === "") errors.push("El tipo de salida no puede estar vacío.");
      if (tipo_salida.length > 50) errors.push("El tipo de salida no puede exceder 50 caracteres.");
    }
    if (id_usuario !== undefined && (isNaN(id_usuario) || id_usuario <= 0)) {
      errors.push("El ID de usuario debe ser un número entero positivo.");
    }
    if (fecha !== undefined) {
      const fechaObj = new Date(fecha);
      if (isNaN(fechaObj.getTime())) errors.push("La fecha proporcionada no es válida.");
    }

    if (errors.length > 0) {
      throwError("Datos inválidos", 400, errors);
    }

    const updateData = {};
    if (id_servicio_tienda !== undefined) updateData.id_servicio_tienda = id_servicio_tienda;
    if (cantidad_total !== undefined) updateData.cantidad_total = cantidad_total;
    if (descripcion !== undefined) updateData.descripcion = descripcion.trim();
    if (tipo_salida !== undefined) updateData.tipo_salida = tipo_salida.trim();
    if (fecha !== undefined) updateData.fecha = fecha;
    if (id_usuario !== undefined) updateData.id_usuario = id_usuario;

    const updated = await salidaService.updateSalida(id, updateData);
    res.status(200).json({
      message: "Salida actualizada correctamente",
      data: updated,
    });
  } catch (error) {
    handleError(res, error);
  }
};

const deleteSalida = async (req, res) => {
  try {
    const { id } = req.params;
    await salidaService.deleteSalida(id);
    res.status(200).json({ message: "Salida eliminada correctamente" });
  } catch (error) {
    handleError(res, error);
  }
};

const filterSalidas = async (req, res) => {
  try {
    const {
      limit,
      page,
      id_tienda,
      id_servicio_tienda,
      id_usuario,
      fecha_desde,
      fecha_hasta,
      tipo_salida,
      descripcion
    } = req.query;

    const hasLimit = limit !== undefined;
    const hasPage = page !== undefined;
    let limitNum = hasLimit ? parseInt(limit, 10) : undefined;
    if (hasLimit && (isNaN(limitNum) || limitNum < 1)) {
      throwError("El parámetro 'limit' debe ser un número entero positivo", 400);
    }
    let pageNum = hasPage ? parseInt(page, 10) : 1;
    if (isNaN(pageNum) || pageNum < 1) {
      throwError("El parámetro 'page' debe ser un número entero positivo", 400);
    }

    const filters = {};
    if (id_tienda) {
      const parsed = parseInt(id_tienda, 10);
      if (isNaN(parsed) || parsed < 1) throwError("El ID de tienda debe ser un número entero positivo", 400);
      filters.id_tienda = parsed;
    }
    if (id_servicio_tienda) {
      const parsed = parseInt(id_servicio_tienda, 10);
      if (isNaN(parsed) || parsed < 1) throwError("El ID de servicio-tienda debe ser un número entero positivo", 400);
      filters.id_servicio_tienda = parsed;
    }
    if (id_usuario) {
      const parsed = parseInt(id_usuario, 10);
      if (isNaN(parsed) || parsed < 1) throwError("El ID de usuario debe ser un número entero positivo", 400);
      filters.id_usuario = parsed;
    }
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
    if (tipo_salida) filters.tipo_salida = tipo_salida.trim();
    if (descripcion) filters.descripcion = descripcion.trim();

    const offset = limitNum === undefined ? undefined : (pageNum - 1) * limitNum;
    const { rows, count } = await salidaService.filterSalidas(filters, limitNum, offset);

    const totalPages = limitNum === undefined ? (count > 0 ? 1 : 0) : Math.ceil(count / limitNum);
    res.status(200).json({
      data: rows,
      pagination: {
        currentPage: pageNum,
        limit: limitNum === undefined ? count : limitNum,
        totalPages,
        totalItems: count,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};

module.exports = {
  createSalida,
  getSalidaById,
  updateSalida,
  deleteSalida,
  filterSalidas,
};