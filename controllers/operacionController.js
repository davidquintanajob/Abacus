const operacionService = require("../services/operacionService");
const { throwError } = require("../helpers/errorLauncher");
const { tiposOperacion } = require("../models/operacion");

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

// ---- CRUD básico ----

const createOperacion = async (req, res) => {
  try {
    const {
      id_cuenta,
      id_usuario,
      cantidad_operacion,
      tipo_operacion,
      fecha_hora,
      motivo,
      cambio_moneda,
    } = req.body;

    const errors = [];
    if (!id_cuenta) errors.push("El campo id_cuenta es obligatorio.");
    if (cantidad_operacion === undefined || cantidad_operacion === null) errors.push("cantidad_operacion es obligatorio.");
    if (!tipo_operacion) errors.push("tipo_operacion es obligatorio.");
    if (!motivo || motivo.trim() === "") errors.push("motivo es obligatorio.");
    if (cambio_moneda === undefined || cambio_moneda === null) errors.push("cambio_moneda es obligatorio.");

    if (cantidad_operacion !== undefined && (isNaN(cantidad_operacion) || cantidad_operacion < 0)) {
      errors.push("cantidad_operacion debe ser un número no negativo.");
    }
    if (tipo_operacion && !tiposOperacion.includes(tipo_operacion)) {
      errors.push(`tipo_operacion debe ser uno de: ${tiposOperacion.join(", ")}.`);
    }
    if (cambio_moneda !== undefined && (isNaN(cambio_moneda) || cambio_moneda <= 0)) {
      errors.push("cambio_moneda debe ser un número mayor que cero.");
    }
    if (fecha_hora !== undefined) {
      const fechaObj = new Date(fecha_hora);
      if (isNaN(fechaObj.getTime())) errors.push("La fecha_hora proporcionada no es válida.");
    }
    if (id_usuario !== undefined && (isNaN(id_usuario) || id_usuario <= 0)) {
      errors.push("id_usuario debe ser un número entero positivo.");
    }

    if (errors.length > 0) {
      throwError("Datos inválidos", 400, errors);
    }

    const operacionData = {
      id_cuenta,
      id_usuario: id_usuario || null,
      cantidad_operacion,
      tipo_operacion,
      fecha_hora: fecha_hora || null,
      motivo: motivo.trim(),
      cambio_moneda,
    };

    const newOperacion = await operacionService.createOperacion(operacionData);
    res.status(201).json({
      message: "Operación creada exitosamente",
      data: newOperacion,
    });
  } catch (error) {
    handleError(res, error);
  }
};

const getOperacionById = async (req, res) => {
  try {
    const { id } = req.params;
    const operacion = await operacionService.getOperacionById(id);
    res.status(200).json(operacion);
  } catch (error) {
    handleError(res, error);
  }
};

const updateOperacion = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      id_cuenta,
      id_usuario,
      cantidad_operacion,
      tipo_operacion,
      fecha_hora,
      motivo,
      cambio_moneda,
    } = req.body;

    if (Object.keys(req.body).length === 0) {
      throwError("Se debe proporcionar al menos un campo para actualizar.", 400);
    }

    const errors = [];
    if (cantidad_operacion !== undefined && (isNaN(cantidad_operacion) || cantidad_operacion < 0)) {
      errors.push("cantidad_operacion debe ser un número no negativo.");
    }
    if (tipo_operacion !== undefined && !tiposOperacion.includes(tipo_operacion)) {
      errors.push(`tipo_operacion debe ser uno de: ${tiposOperacion.join(", ")}.`);
    }
    if (cambio_moneda !== undefined && (isNaN(cambio_moneda) || cambio_moneda <= 0)) {
      errors.push("cambio_moneda debe ser un número mayor que cero.");
    }
    if (fecha_hora !== undefined) {
      const fechaObj = new Date(fecha_hora);
      if (isNaN(fechaObj.getTime())) errors.push("La fecha_hora proporcionada no es válida.");
    }
    if (id_usuario !== undefined && id_usuario !== null && (isNaN(id_usuario) || id_usuario <= 0)) {
      errors.push("id_usuario debe ser un número entero positivo.");
    }
    if (id_cuenta !== undefined && (isNaN(id_cuenta) || id_cuenta <= 0)) {
      errors.push("id_cuenta debe ser un número entero positivo.");
    }

    if (errors.length > 0) {
      throwError("Datos inválidos", 400, errors);
    }

    const updateData = {};
    if (id_cuenta !== undefined) updateData.id_cuenta = id_cuenta;
    if (id_usuario !== undefined) updateData.id_usuario = id_usuario || null;
    if (cantidad_operacion !== undefined) updateData.cantidad_operacion = cantidad_operacion;
    if (tipo_operacion !== undefined) updateData.tipo_operacion = tipo_operacion;
    if (fecha_hora !== undefined) updateData.fecha_hora = fecha_hora;
    if (motivo !== undefined) updateData.motivo = motivo.trim();
    if (cambio_moneda !== undefined) updateData.cambio_moneda = cambio_moneda;

    const updated = await operacionService.updateOperacion(id, updateData);
    res.status(200).json({
      message: "Operación actualizada correctamente",
      data: updated,
    });
  } catch (error) {
    handleError(res, error);
  }
};

const deleteOperacion = async (req, res) => {
  try {
    const { id } = req.params;
    await operacionService.deleteOperacion(id);
    res.status(200).json({ message: "Operación eliminada correctamente" });
  } catch (error) {
    handleError(res, error);
  }
};

// ---- Bulk operations ----

const createOperacionesBulk = async (req, res) => {
  try {
    const { operaciones } = req.body;
    if (!Array.isArray(operaciones) || operaciones.length === 0) {
      throwError("El campo 'operaciones' debe ser un arreglo no vacío.", 400);
    }

    const errors = [];
    const operacionesData = [];

    operaciones.forEach((item, index) => {
      if (!item || typeof item !== "object") {
        errors.push(`Operación ${index + 1}: objeto inválido.`);
        return;
      }

      const {
        id_cuenta,
        id_usuario,
        cantidad_operacion,
        tipo_operacion,
        fecha_hora,
        motivo,
        cambio_moneda,
      } = item;

      const localErrors = [];
      if (!id_cuenta) localErrors.push("id_cuenta es obligatorio.");
      if (cantidad_operacion === undefined || cantidad_operacion === null) localErrors.push("cantidad_operacion es obligatorio.");
      if (!tipo_operacion) localErrors.push("tipo_operacion es obligatorio.");
      if (!motivo || motivo.trim() === "") localErrors.push("motivo es obligatorio.");
      if (cambio_moneda === undefined || cambio_moneda === null) localErrors.push("cambio_moneda es obligatorio.");

      if (cantidad_operacion !== undefined && (isNaN(cantidad_operacion) || cantidad_operacion < 0)) {
        localErrors.push("cantidad_operacion debe ser no negativo.");
      }
      if (tipo_operacion && !tiposOperacion.includes(tipo_operacion)) {
        localErrors.push(`tipo_operacion debe ser uno de: ${tiposOperacion.join(", ")}.`);
      }
      if (cambio_moneda !== undefined && (isNaN(cambio_moneda) || cambio_moneda <= 0)) {
        localErrors.push("cambio_moneda debe ser mayor que cero.");
      }
      if (fecha_hora !== undefined) {
        const fechaObj = new Date(fecha_hora);
        if (isNaN(fechaObj.getTime())) localErrors.push("fecha_hora inválida.");
      }
      if (id_usuario !== undefined && id_usuario !== null && (isNaN(id_usuario) || id_usuario <= 0)) {
        localErrors.push("id_usuario debe ser entero positivo.");
      }

      if (localErrors.length > 0) {
        errors.push(`Operación ${index + 1}: ${localErrors.join(" ")}`);
        return;
      }

      operacionesData.push({
        id_cuenta,
        id_usuario: id_usuario || null,
        cantidad_operacion,
        tipo_operacion,
        fecha_hora: fecha_hora || null,
        motivo: motivo.trim(),
        cambio_moneda,
      });
    });

    if (errors.length > 0) {
      throwError("Datos inválidos en algunas operaciones", 400, errors);
    }

    const result = await operacionService.createOperacionesBulk(operacionesData);
    res.status(201).json({
      message: "Operaciones creadas exitosamente",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

const updateOperacionesBulk = async (req, res) => {
  try {
    const { operaciones } = req.body;
    if (!Array.isArray(operaciones) || operaciones.length === 0) {
      throwError("El campo 'operaciones' debe ser un arreglo no vacío.", 400);
    }

    const errors = [];
    const updatesData = [];

    operaciones.forEach((item, index) => {
      if (!item || typeof item !== "object") {
        errors.push(`Operación ${index + 1}: objeto inválido.`);
        return;
      }

      const { id_operacion, ...rest } = item;
      if (!id_operacion || isNaN(id_operacion) || id_operacion <= 0) {
        errors.push(`Operación ${index + 1}: id_operacion es obligatorio y debe ser entero positivo.`);
        return;
      }

      const localErrors = [];
      if (rest.cantidad_operacion !== undefined && (isNaN(rest.cantidad_operacion) || rest.cantidad_operacion < 0)) {
        localErrors.push("cantidad_operacion debe ser no negativo.");
      }
      if (rest.tipo_operacion !== undefined && !tiposOperacion.includes(rest.tipo_operacion)) {
        localErrors.push(`tipo_operacion debe ser uno de: ${tiposOperacion.join(", ")}.`);
      }
      if (rest.cambio_moneda !== undefined && (isNaN(rest.cambio_moneda) || rest.cambio_moneda <= 0)) {
        localErrors.push("cambio_moneda debe ser mayor que cero.");
      }
      if (rest.fecha_hora !== undefined) {
        const fechaObj = new Date(rest.fecha_hora);
        if (isNaN(fechaObj.getTime())) localErrors.push("fecha_hora inválida.");
      }
      if (rest.id_usuario !== undefined && rest.id_usuario !== null && (isNaN(rest.id_usuario) || rest.id_usuario <= 0)) {
        localErrors.push("id_usuario debe ser entero positivo.");
      }
      if (rest.id_cuenta !== undefined && (isNaN(rest.id_cuenta) || rest.id_cuenta <= 0)) {
        localErrors.push("id_cuenta debe ser entero positivo.");
      }

      if (localErrors.length > 0) {
        errors.push(`Operación ${index + 1}: ${localErrors.join(" ")}`);
        return;
      }

      updatesData.push({
        id_operacion,
        ...rest,
        ...(rest.motivo !== undefined && { motivo: rest.motivo.trim() }),
        ...(rest.id_usuario !== undefined && { id_usuario: rest.id_usuario || null }),
      });
    });

    if (errors.length > 0) {
      throwError("Datos inválidos en algunas operaciones", 400, errors);
    }

    const result = await operacionService.updateOperacionesBulk(updatesData);
    res.status(200).json({
      message: "Operaciones actualizadas correctamente",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// ---- Filtro con paginación ----

const filterOperaciones = async (req, res) => {
  try {
    const {
      limit,
      page,
      nombre_cuenta,
      nombre_usuario,
      id_tienda,
      fecha_desde,
      fecha_hasta,
      cantidad_min,
      cantidad_max,
      tipo_operacion,
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
    if (nombre_cuenta) filters.nombre_cuenta = nombre_cuenta.trim();
    if (nombre_usuario) filters.nombre_usuario = nombre_usuario.trim();
    if (tipo_operacion !== undefined) {
      const tiposFiltro = [...tiposOperacion, "Operaciones Manuales"];
      if (!tiposFiltro.includes(tipo_operacion)) {
        throwError(`tipo_operacion debe ser uno de: ${tiposFiltro.join(", ")}.`, 400);
      }
      filters.tipo_operacion = tipo_operacion;
    }
    if (id_tienda !== undefined) {
      const tiendaId = parseInt(id_tienda, 10);
      if (isNaN(tiendaId) || tiendaId < 1 || String(tiendaId) !== String(id_tienda).trim()) {
        throwError("id_tienda debe ser un número entero positivo.", 400);
      }
      filters.id_tienda = tiendaId;
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

    const offset = (pageNum - 1) * limitNum;
    const result = await operacionService.filterOperaciones(filters, limitNum, offset);

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

module.exports = {
  createOperacion,
  getOperacionById,
  updateOperacion,
  deleteOperacion,
  createOperacionesBulk,
  updateOperacionesBulk,
  filterOperaciones,
};