const notificacionService = require("../services/notificacionService");
const { tiposNotificacion } = require("../models/notificacion");
const { throwError } = require("../helpers/errorLauncher");

const handleError = (res, error) => {
  const status = error.status || 500;
  const message = error.message || "Error interno del servidor";
  let errors = error.errors;
  if (!Array.isArray(errors) || errors.length === 0) errors = [message];
  res.status(status).json({
    errors: errors.map(item => typeof item === "string" ? item : String(item)),
  });
};

const validateNotificationFields = (body, { creating }) => {
  const errors = [];
  const requiredFields = creating
    ? ["titulo", "mensaje", "fecha_hora", "tipo"]
    : [];

  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      errors.push(`${field} es obligatorio`);
    }
  }
  for (const field of ["titulo", "mensaje"]) {
    if (body[field] !== undefined && (typeof body[field] !== "string" || !body[field].trim())) {
      errors.push(`${field} debe ser una cadena no vacía`);
    }
  }
  if (body.fecha_hora !== undefined &&
      (typeof body.fecha_hora !== "string" || Number.isNaN(new Date(body.fecha_hora).getTime()))) {
    errors.push("fecha_hora debe ser una fecha válida");
  }
  if (body.tipo !== undefined && !tiposNotificacion.includes(body.tipo)) {
    errors.push(`tipo debe ser uno de: ${tiposNotificacion.join(", ")}`);
  }
  if (body.id_relacion !== undefined && body.id_relacion !== null && typeof body.id_relacion !== "string") {
    errors.push("id_relacion debe ser una cadena o null");
  }
  if (creating && body.is_read === true) {
    errors.push("is_read no puede ser true al crear una notificación");
  }
  if (creating && body.is_read !== undefined && typeof body.is_read !== "boolean") {
    errors.push("is_read debe ser booleano");
  }
  if (!creating && body.is_read !== undefined && typeof body.is_read !== "boolean") {
    errors.push("is_read debe ser booleano");
  }
  if (errors.length > 0) throwError("Datos de notificación inválidos", 400, errors);
};

const getTarget = (body) => ({
  id_tienda: body.id_tienda,
  id_usuarios: body.id_usuarios,
});

const createNotification = async (req, res) => {
  try {
    const body = req.body || {};
    validateNotificationFields(body, { creating: true });
    const notificationData = {
      titulo: body.titulo.trim(),
      mensaje: body.mensaje.trim(),
      fecha_hora: new Date(body.fecha_hora),
      tipo: body.tipo,
      is_read: false,
    };
    if (body.id_relacion !== undefined) notificationData.id_relacion = body.id_relacion;

    const data = await notificacionService.createNotifications({
      ...getTarget(body),
      notificationData,
    });
    return res.status(201).json({
      message: "Notificación creada correctamente para los usuarios seleccionados",
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const updateNotifications = async (req, res) => {
  try {
    const body = req.body || {};
    validateNotificationFields(body, { creating: false });
    const updateData = {};
    for (const field of ["titulo", "mensaje", "tipo", "is_read", "id_relacion"]) {
      if (body[field] !== undefined) {
        updateData[field] = typeof body[field] === "string" && ["titulo", "mensaje"].includes(field)
          ? body[field].trim()
          : body[field];
      }
    }
    if (body.fecha_hora !== undefined) updateData.fecha_hora = new Date(body.fecha_hora);
    if (Object.keys(updateData).length === 0) {
      throwError("Debe proporcionar al menos un campo de notificación para actualizar", 400);
    }

    const data = await notificacionService.updateNotifications({
      ...getTarget(body),
      updateData,
    });
    return res.status(200).json({
      message: "Notificaciones actualizadas correctamente",
      updatedCount: data.length,
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const filterNotifications = async (req, res) => {
  try {
    const { page, limit, id_usuario, fecha_desde, fecha_hasta, tipo, titulo } = req.query;
    if (typeof page !== "string" || !/^[1-9]\d*$/.test(page)) {
      throwError("El parámetro page es obligatorio y debe ser un entero positivo", 400);
    }
    if (typeof limit !== "string" || !/^[1-9]\d*$/.test(limit)) {
      throwError("El parámetro limit es obligatorio y debe ser un entero positivo", 400);
    }
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const filters = {};

    if (id_usuario !== undefined) {
      if (typeof id_usuario !== "string" || !/^[1-9]\d*$/.test(id_usuario)) {
        throwError("id_usuario debe ser un entero positivo", 400);
      }
      filters.id_usuario = Number(id_usuario);
    }
    if (fecha_desde !== undefined) {
      if (typeof fecha_desde !== "string") throwError("fecha_desde debe ser una fecha válida", 400);
      filters.fecha_desde = fecha_desde;
    }
    if (fecha_hasta !== undefined) {
      if (typeof fecha_hasta !== "string") throwError("fecha_hasta debe ser una fecha válida", 400);
      filters.fecha_hasta = fecha_hasta;
    }
    if (tipo !== undefined) {
      if (typeof tipo !== "string" || !tiposNotificacion.includes(tipo)) {
        throwError(`tipo debe ser uno de: ${tiposNotificacion.join(", ")}`, 400);
      }
      filters.tipo = tipo;
    }
    if (titulo !== undefined) {
      if (typeof titulo !== "string") throwError("titulo debe ser una cadena", 400);
      filters.titulo = titulo.trim();
    }

    const { rows, count } = await notificacionService.filterNotifications(
      filters,
      limitNumber,
      (pageNumber - 1) * limitNumber
    );
    return res.status(200).json({
      data: rows,
      pagination: {
        currentPage: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(count / limitNumber),
        totalItems: count,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
};

module.exports = {
  createNotification,
  updateNotifications,
  filterNotifications,
};
