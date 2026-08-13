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
    } = req.query;

    let limitNum = parseInt(limit, 10) || 10;
    if (isNaN(limitNum) || limitNum < 1) {
      throwError("El parámetro 'limit' debe ser un número entero positivo", 400);
    }
    let pageNum = parseInt(page, 10) || 1;
    if (isNaN(pageNum) || pageNum < 1) {
      throwError("El parámetro 'page' debe ser un número entero positivo", 400);
    }

    const filters = {};

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

    const offset = (pageNum - 1) * limitNum;
    const { rows, count } = await entradaService.filterEntradas(filters, limitNum, offset);

    const totalPages = Math.ceil(count / limitNum);
    res.status(200).json({
      data: rows,
      pagination: {
        currentPage: pageNum,
        limit: limitNum,
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
  createEntradasBulk,
  getEntradaById,
  updateEntrada,
  deleteEntrada,
  filterEntradas,
};