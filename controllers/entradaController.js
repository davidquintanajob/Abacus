const entradaService = require("../services/entradaService");
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

const validateFabricaciones = (fabricaciones, permitirVacio = false) => {
  if (!Array.isArray(fabricaciones) || (!permitirVacio && fabricaciones.length === 0)) {
    throwError(
      permitirVacio
        ? "El campo 'fabricaciones' debe ser un arreglo."
        : "El campo 'fabricaciones' debe ser un arreglo no vacío.",
      400
    );
  }

  const errors = [];
  const normalized = fabricaciones.map((fabricacion, index) => {
    if (!fabricacion || typeof fabricacion !== "object" || Array.isArray(fabricacion)) {
      errors.push(`Fabricación ${index + 1}: El objeto es inválido.`);
      return null;
    }

    const {
      id_servicio_tienda,
      cantidad_insumo,
      costo_insumo_cup,
      costo_insumo_usd,
    } = fabricacion;

    if (!Number.isInteger(Number(id_servicio_tienda)) || Number(id_servicio_tienda) <= 0) {
      errors.push(`Fabricación ${index + 1}: El id_servicio_tienda debe ser un entero positivo.`);
    }
    if (cantidad_insumo === undefined || cantidad_insumo === null ||
      !Number.isFinite(Number(cantidad_insumo)) || Number(cantidad_insumo) <= 0) {
      errors.push(`Fabricación ${index + 1}: La cantidad_insumo debe ser mayor que cero.`);
    }
    if (costo_insumo_cup === undefined || costo_insumo_cup === null ||
      !Number.isFinite(Number(costo_insumo_cup)) || Number(costo_insumo_cup) < 0) {
      errors.push(`Fabricación ${index + 1}: El costo_insumo_cup es obligatorio y no puede ser negativo.`);
    }
    if (costo_insumo_usd === undefined || costo_insumo_usd === null ||
      !Number.isFinite(Number(costo_insumo_usd)) || Number(costo_insumo_usd) < 0) {
      errors.push(`Fabricación ${index + 1}: El costo_insumo_usd es obligatorio y no puede ser negativo.`);
    }

    return {
      id_servicio_tienda: Number(id_servicio_tienda),
      cantidad_insumo: Number(cantidad_insumo),
      costo_insumo_cup: Number(costo_insumo_cup),
      costo_insumo_usd: Number(costo_insumo_usd),
    };
  });

  if (errors.length > 0) {
    throwError("Datos inválidos en las fabricaciones", 400, errors);
  }
  return normalized;
};

const createEntrada = async (req, res) => {
  try {
    const { id_servicio_tienda, cantidad_entrada, costo_usd, costo_cup, fecha_vencimiento, nombre_proveedor, id_usuario, fecha } = req.body;
    const usuarioId = id_usuario || req.user.id_usuario;

    const errors = [];
    if (!id_servicio_tienda) errors.push("El campo id_servicio_tienda es obligatorio.");
    if (!cantidad_entrada && cantidad_entrada !== 0) errors.push("La cantidad de entrada es obligatoria.");
    if (cantidad_entrada !== undefined && (isNaN(cantidad_entrada) || cantidad_entrada <= 0)) {
      errors.push("La cantidad de entrada debe ser un número mayor que cero.");
    }
    if (costo_usd === undefined || costo_usd === null) errors.push("El costo en USD es obligatorio.");
    if (isNaN(costo_usd) || costo_usd < 0) errors.push("El costo en USD no puede ser negativo.");
    if (costo_cup === undefined || costo_cup === null) errors.push("El costo en CUP es obligatorio.");
    if (isNaN(costo_cup) || costo_cup < 0) errors.push("El costo en CUP no puede ser negativo.");
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

    const entradaData = {
      id_servicio_tienda,
      cantidad_entrada,
      costo_usd,
      costo_cup,
      fecha_vencimiento: fecha_vencimiento || null,
      nombre_proveedor: nombre_proveedor || null,
      id_usuario: usuarioId,
      fecha: fecha || null,
    };

    const newEntrada = await entradaService.createEntrada(entradaData);
    res.status(201).json({
      message: "Entrada creada exitosamente",
      data: newEntrada,
    });
  } catch (error) {
    handleError(res, error);
  }
};

const createEntradaWithFabricaciones = async (req, res) => {
  try {
    const {
      id_servicio_tienda,
      cantidad_entrada,
      costo_usd,
      costo_cup,
      fecha_vencimiento,
      nombre_proveedor,
      id_usuario,
      fecha,
      fabricaciones,
    } = req.body;
    const usuarioId = id_usuario || req.user.id_usuario;

    const errors = [];
    if (!id_servicio_tienda) errors.push("El campo id_servicio_tienda es obligatorio.");
    if (!cantidad_entrada && cantidad_entrada !== 0) errors.push("La cantidad de entrada es obligatoria.");
    if (cantidad_entrada !== undefined && (isNaN(cantidad_entrada) || cantidad_entrada <= 0)) {
      errors.push("La cantidad de entrada debe ser un número mayor que cero.");
    }
    if (costo_usd === undefined || costo_usd === null) errors.push("El costo en USD es obligatorio.");
    if (isNaN(costo_usd) || costo_usd < 0) errors.push("El costo en USD no puede ser negativo.");
    if (costo_cup === undefined || costo_cup === null) errors.push("El costo en CUP es obligatorio.");
    if (isNaN(costo_cup) || costo_cup < 0) errors.push("El costo en CUP no puede ser negativo.");
    if (id_usuario !== undefined && (isNaN(id_usuario) || id_usuario <= 0)) {
      errors.push("El ID de usuario debe ser un número entero positivo.");
    }
    if (fecha !== undefined && isNaN(new Date(fecha).getTime())) {
      errors.push("La fecha proporcionada no es válida.");
    }
    if (errors.length > 0) {
      throwError("Datos inválidos", 400, errors);
    }

    const fabricacionesData = validateFabricaciones(fabricaciones);
    const entradaData = {
      id_servicio_tienda,
      cantidad_entrada,
      costo_usd,
      costo_cup,
      fecha_vencimiento: fecha_vencimiento || null,
      nombre_proveedor: nombre_proveedor || null,
      id_usuario: usuarioId,
      fecha: fecha || null,
    };

    const newEntrada = await entradaService.createEntradaWithFabricaciones(entradaData, fabricacionesData);
    res.status(201).json({
      message: "Entrada creada exitosamente",
      data: newEntrada,
    });
  } catch (error) {
    handleError(res, error);
  }
};

const createEntradasBulk = async (req, res) => {
  try {
    const { entradas } = req.body;

    if (!Array.isArray(entradas) || entradas.length === 0) {
      throwError("El campo 'entradas' debe ser un arreglo no vacío.", 400);
    }

    const entradasData = [];
    const errors = [];

    entradas.forEach((item, index) => {
      if (!item || typeof item !== 'object') {
        errors.push(`Entrada ${index + 1}: El objeto de entrada es inválido.`);
        return;
      }

      const {
        id_servicio_tienda,
        cantidad_entrada,
        costo_usd,
        costo_cup,
        fecha_vencimiento,
        nombre_proveedor,
        id_usuario,
        fecha
      } = item;

      const localErrors = [];

      // Validar campos requeridos (id_usuario es obligatorio aquí)
      if (id_servicio_tienda === undefined || id_servicio_tienda === null) {
        localErrors.push("El campo id_servicio_tienda es obligatorio.");
      }
      if (cantidad_entrada === undefined || cantidad_entrada === null) {
        localErrors.push("La cantidad de entrada es obligatoria.");
      }
      if (costo_usd === undefined || costo_usd === null) {
        localErrors.push("El costo en USD es obligatorio.");
      }
      if (costo_cup === undefined || costo_cup === null) {
        localErrors.push("El costo en CUP es obligatorio.");
      }
      if (id_usuario === undefined || id_usuario === null) {
        localErrors.push("El ID de usuario es obligatorio.");
      }

      // Validar tipos y valores
      if (id_servicio_tienda !== undefined && (isNaN(id_servicio_tienda) || id_servicio_tienda <= 0)) {
        localErrors.push("El ID de servicio-tienda debe ser un número entero positivo.");
      }
      if (cantidad_entrada !== undefined && (isNaN(cantidad_entrada) || cantidad_entrada <= 0)) {
        localErrors.push("La cantidad de entrada debe ser un número mayor que cero.");
      }
      if (costo_usd !== undefined && (isNaN(costo_usd) || costo_usd < 0)) {
        localErrors.push("El costo en USD no puede ser negativo.");
      }
      if (costo_cup !== undefined && (isNaN(costo_cup) || costo_cup < 0)) {
        localErrors.push("El costo en CUP no puede ser negativo.");
      }
      if (id_usuario !== undefined && (isNaN(id_usuario) || id_usuario <= 0)) {
        localErrors.push("El ID de usuario debe ser un número entero positivo.");
      }
      if (fecha !== undefined) {
        const fechaObj = new Date(fecha);
        if (isNaN(fechaObj.getTime())) {
          localErrors.push("La fecha proporcionada no es válida.");
        }
      }

      if (localErrors.length > 0) {
        errors.push(`Entrada ${index + 1}: ${localErrors.join(' ')}`);
        return;
      }

      entradasData.push({
        id_servicio_tienda,
        cantidad_entrada,
        costo_usd,
        costo_cup,
        fecha_vencimiento: fecha_vencimiento || null,
        nombre_proveedor: nombre_proveedor || null,
        id_usuario: id_usuario, // siempre debe estar presente
        fecha: fecha || null,
      });
    });

    if (errors.length > 0) {
      throwError("Datos inválidos en algunas entradas", 400, errors);
    }

    const newEntradas = await entradaService.createEntradasBulk(entradasData);
    res.status(201).json({
      message: "Entradas creadas exitosamente",
      data: newEntradas,
    });
  } catch (error) {
    handleError(res, error);
  }
};

const getEntradaById = async (req, res) => {
  try {
    const { id } = req.params;
    const entrada = await entradaService.getEntradaById(id);
    res.status(200).json(entrada);
  } catch (error) {
    handleError(res, error);
  }
};

const updateEntrada = async (req, res) => {
  try {
    const { id } = req.params;
    const { id_servicio_tienda, cantidad_entrada, costo_usd, costo_cup, fecha_vencimiento, nombre_proveedor, id_usuario, fecha } = req.body;

    if (Object.keys(req.body).length === 0) {
      throwError("Se debe proporcionar al menos un campo para actualizar", 400);
    }

    const errors = [];
    if (id_servicio_tienda !== undefined) {
      if (isNaN(id_servicio_tienda) || id_servicio_tienda <= 0) {
        errors.push("El ID de servicio-tienda debe ser un número entero positivo.");
      }
    }
    if (cantidad_entrada !== undefined) {
      if (isNaN(cantidad_entrada) || cantidad_entrada <= 0) {
        errors.push("La cantidad de entrada debe ser un número mayor que cero.");
      }
    }
    if (costo_usd !== undefined && (isNaN(costo_usd) || costo_usd < 0)) {
      errors.push("El costo en USD no puede ser negativo.");
    }
    if (costo_cup !== undefined && (isNaN(costo_cup) || costo_cup < 0)) {
      errors.push("El costo en CUP no puede ser negativo.");
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
    if (cantidad_entrada !== undefined) updateData.cantidad_entrada = cantidad_entrada;
    if (costo_usd !== undefined) updateData.costo_usd = costo_usd;
    if (costo_cup !== undefined) updateData.costo_cup = costo_cup;
    if (fecha_vencimiento !== undefined) updateData.fecha_vencimiento = fecha_vencimiento || null;
    if (nombre_proveedor !== undefined) updateData.nombre_proveedor = nombre_proveedor || null;
    if (id_usuario !== undefined) updateData.id_usuario = id_usuario;
    if (fecha !== undefined) updateData.fecha = fecha;

    const updated = await entradaService.updateEntrada(id, updateData);
    res.status(200).json({
      message: "Entrada actualizada correctamente",
      data: updated,
    });
  } catch (error) {
    handleError(res, error);
  }
};

const updateEntradaWithFabricaciones = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      id_servicio_tienda,
      cantidad_entrada,
      costo_usd,
      costo_cup,
      fecha_vencimiento,
      nombre_proveedor,
      id_usuario,
      fecha,
      fabricaciones,
    } = req.body;

    if (Object.keys(req.body).length === 0) {
      throwError("Se debe proporcionar al menos un campo para actualizar", 400);
    }

    const errors = [];
    if (id_servicio_tienda !== undefined &&
      (!Number.isInteger(Number(id_servicio_tienda)) || Number(id_servicio_tienda) <= 0)) {
      errors.push("El ID de servicio-tienda debe ser un número entero positivo.");
    }
    if (cantidad_entrada !== undefined && (isNaN(cantidad_entrada) || cantidad_entrada <= 0)) {
      errors.push("La cantidad de entrada debe ser un número mayor que cero.");
    }
    if (costo_usd !== undefined && (isNaN(costo_usd) || costo_usd < 0)) {
      errors.push("El costo en USD no puede ser negativo.");
    }
    if (costo_cup !== undefined && (isNaN(costo_cup) || costo_cup < 0)) {
      errors.push("El costo en CUP no puede ser negativo.");
    }
    if (id_usuario !== undefined && (isNaN(id_usuario) || id_usuario <= 0)) {
      errors.push("El ID de usuario debe ser un número entero positivo.");
    }
    if (fecha !== undefined && isNaN(new Date(fecha).getTime())) {
      errors.push("La fecha proporcionada no es válida.");
    }
    if (errors.length > 0) {
      throwError("Datos inválidos", 400, errors);
    }

    const fabricacionesData = validateFabricaciones(fabricaciones, true);
    const updateData = {};
    if (id_servicio_tienda !== undefined) updateData.id_servicio_tienda = id_servicio_tienda;
    if (cantidad_entrada !== undefined) updateData.cantidad_entrada = cantidad_entrada;
    if (costo_usd !== undefined) updateData.costo_usd = costo_usd;
    if (costo_cup !== undefined) updateData.costo_cup = costo_cup;
    if (fecha_vencimiento !== undefined) updateData.fecha_vencimiento = fecha_vencimiento || null;
    if (nombre_proveedor !== undefined) updateData.nombre_proveedor = nombre_proveedor || null;
    if (id_usuario !== undefined) updateData.id_usuario = id_usuario;
    if (fecha !== undefined) updateData.fecha = fecha;

    const updated = await entradaService.updateEntrada(id, updateData, fabricacionesData);
    res.status(200).json({
      message: "Entrada actualizada correctamente",
      data: updated,
    });
  } catch (error) {
    handleError(res, error);
  }
};

const deleteEntrada = async (req, res) => {
  try {
    const { id } = req.params;
    await entradaService.deleteEntrada(id);
    res.status(200).json({ message: "Entrada eliminada correctamente" });
  } catch (error) {
    handleError(res, error);
  }
};

const filterEntradas = async (req, res) => {
  try {
    const {
      limit,
      page,
      id_servicio_tienda,
      id_usuario,
      fecha_desde,
      fecha_hasta,
      nombre_servicio,
      codigo_lote,
      id_tienda,
      id_servicio,
      cantidad_restante_min,
      cantidad_restante_max,
      fecha_vencimiento_desde, // nuevo
      fecha_vencimiento_hasta, // nuevo
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

    // Filtros existentes
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
    if (nombre_servicio) filters.nombre_servicio = nombre_servicio.trim();
    if (codigo_lote) filters.codigo_lote = codigo_lote.trim();
    if (id_tienda) {
      const parsed = parseInt(id_tienda, 10);
      if (isNaN(parsed) || parsed < 1) throwError("El ID de tienda debe ser un número entero positivo", 400);
      filters.id_tienda = parsed;
    }
    if (id_servicio) {
      const parsed = parseInt(id_servicio, 10);
      if (isNaN(parsed) || parsed < 1) throwError("El ID de servicio debe ser un número entero positivo", 400);
      filters.id_servicio = parsed;
    }

    // Nuevos filtros de cantidad_restante
    if (cantidad_restante_min !== undefined) {
      const parsed = parseFloat(cantidad_restante_min);
      if (isNaN(parsed) || parsed < 0) {
        throwError("El parámetro 'cantidad_restante_min' debe ser un número mayor o igual a cero", 400);
      }
      filters.cantidad_restante_min = parsed;
    }
    if (cantidad_restante_max !== undefined) {
      const parsed = parseFloat(cantidad_restante_max);
      if (isNaN(parsed) || parsed < 0) {
        throwError("El parámetro 'cantidad_restante_max' debe ser un número mayor o igual a cero", 400);
      }
      filters.cantidad_restante_max = parsed;
    }
    if (filters.cantidad_restante_min !== undefined && filters.cantidad_restante_max !== undefined) {
      if (filters.cantidad_restante_min > filters.cantidad_restante_max) {
        throwError("La cantidad restante mínima no puede ser mayor que la máxima", 400);
      }
    }

    // Nuevos filtros de fecha_vencimiento
    if (fecha_vencimiento_desde) {
      const date = new Date(fecha_vencimiento_desde);
      if (isNaN(date.getTime())) throwError("Fecha de vencimiento desde inválida (formato YYYY-MM-DD)", 400);
      filters.fecha_vencimiento_desde = date;
    }
    if (fecha_vencimiento_hasta) {
      const date = new Date(fecha_vencimiento_hasta);
      if (isNaN(date.getTime())) throwError("Fecha de vencimiento hasta inválida (formato YYYY-MM-DD)", 400);
      filters.fecha_vencimiento_hasta = date;
    }
    if (filters.fecha_vencimiento_desde && filters.fecha_vencimiento_hasta) {
      if (filters.fecha_vencimiento_desde > filters.fecha_vencimiento_hasta) {
        throwError("La fecha de vencimiento desde no puede ser mayor que la fecha de vencimiento hasta", 400);
      }
    }

    const offset = limitNum === undefined ? undefined : (pageNum - 1) * limitNum;
    const { rows, count } = await entradaService.filterEntradas(filters, limitNum, offset);

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
  createEntrada,
  createEntradaWithFabricaciones,
  createEntradasBulk,
  getEntradaById,
  updateEntrada,
  updateEntradaWithFabricaciones,
  deleteEntrada,
  filterEntradas,
};