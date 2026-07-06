const tiendaService = require("../services/tiendaService");
const { throwError } = require("../helpers/errorLauncher");

// Función auxiliar para responder errores (reutiliza el mismo estilo que usuarioController)
const handleError = (res, error) => {
  const status = error.status || 500;
  const message = error.message || "Error interno del servidor";
  let errors = error.errors;
  if (!Array.isArray(errors) || errors.length === 0) {
    errors = [message];
  }
  errors = errors.map(e => typeof e === 'string' ? e : String(e));
  res.status(status).json({ errors });
};

// GET /tienda/:id
const getTiendaById = async (req, res) => {
  try {
    const { id } = req.params;
    const tienda = await tiendaService.getTiendaById(id);
    res.status(200).json(tienda);
  } catch (error) {
    handleError(res, error);
  }
};

// POST /tienda (crear)
const createTienda = async (req, res) => {
  try {
    const { nombre, tipo, activo } = req.body;
    const errors = [];

    if (!nombre) errors.push("nombre es requerido");
    if (!tipo) errors.push("tipo es requerido");

    if (nombre && (nombre.length < 3 || nombre.length > 100)) {
      errors.push("nombre debe tener entre 3 y 100 caracteres");
    }
    if (tipo && (tipo.length < 2 || tipo.length > 50)) {
      errors.push("tipo debe tener entre 2 y 50 caracteres");
    }

    if (errors.length > 0) {
      throwError("Datos inválidos", 400, errors);
    }

    const tiendaData = {
      nombre,
      tipo,
      activo: activo !== undefined ? activo : true,
    };

    const newTienda = await tiendaService.createTienda(tiendaData);
    res.status(201).json({
      message: "Tienda creada exitosamente",
      data: {
        id_tienda: newTienda.id_tienda,
        nombre: newTienda.nombre,
        tipo: newTienda.tipo,
        activo: newTienda.activo,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};

// PUT /tienda/:id
const updateTienda = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, tipo, activo } = req.body;
    const errors = [];

    if (Object.keys(req.body).length === 0) {
      throwError("Se debe proporcionar al menos un campo para actualizar", 400);
    }

    if (nombre && (nombre.length < 3 || nombre.length > 100)) {
      errors.push("nombre debe tener entre 3 y 100 caracteres");
    }
    if (tipo && (tipo.length < 2 || tipo.length > 50)) {
      errors.push("tipo debe tener entre 2 y 50 caracteres");
    }

    if (errors.length > 0) {
      throwError("Datos inválidos", 400, errors);
    }

    const tiendaData = {};
    if (nombre !== undefined) tiendaData.nombre = nombre;
    if (tipo !== undefined) tiendaData.tipo = tipo;
    if (activo !== undefined) tiendaData.activo = activo;

    const tiendaActualizada = await tiendaService.updateTienda(id, tiendaData);
    res.status(200).json({
      message: "Tienda actualizada correctamente",
      data: tiendaActualizada,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// DELETE /tienda/:id
const deleteTienda = async (req, res) => {
  try {
    const { id } = req.params;
    await tiendaService.deleteTienda(id);
    res.status(200).json({ message: "Tienda eliminada correctamente" });
  } catch (error) {
    handleError(res, error);
  }
};

// GET /tienda/filter
const filterTiendas = async (req, res) => {
  try {
    const { limit, page, ...filters } = req.query;

    let limitNum = parseInt(limit, 10) || 10;
    if (isNaN(limitNum) || limitNum < 1) {
      throwError("El parámetro 'limit' debe ser un número entero positivo", 400);
    }

    let pageNum = parseInt(page, 10) || 1;
    if (isNaN(pageNum) || pageNum < 1) {
      throwError("El parámetro 'page' debe ser un número entero positivo", 400);
    }

    // Filtros permitidos
    const allowedFilters = ["nombre", "tipo", "activo"];
    const filterCriteria = {};
    for (const key of allowedFilters) {
      if (filters[key] !== undefined) {
        filterCriteria[key] = filters[key];
      }
    }

    // Convertir 'activo' a booleano si viene como string
    if (filterCriteria.activo !== undefined) {
      if (filterCriteria.activo === "true") filterCriteria.activo = true;
      else if (filterCriteria.activo === "false") filterCriteria.activo = false;
      else if (typeof filterCriteria.activo !== "boolean") {
        throwError("El filtro 'activo' debe ser true o false", 400);
      }
    }

    const offset = (pageNum - 1) * limitNum;
    const { rows: tiendas, count: total } = await tiendaService.filterTiendas(
      filterCriteria,
      limitNum,
      offset
    );

    const totalPages = Math.ceil(total / limitNum);

    const response = {
      data: tiendas,
      pagination: {
        currentPage: pageNum,
        limit: limitNum,
        totalPages,
        totalItems: total,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    handleError(res, error);
  }
};

module.exports = {
  getTiendaById,
  createTienda,
  updateTienda,
  deleteTienda,
  filterTiendas,
};