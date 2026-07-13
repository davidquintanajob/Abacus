const servicioService = require("../services/servicioService");
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

const createServicio = async (req, res) => {
  try {
    const {
      nombre,
      categoria,
      esvendible,
      nota,
      servicioTiendaList = [],
      ofertaList = [],
      codigoList,
      codigos,
      codigo,
    } = req.body;

    const errors = [];
    if (!nombre) errors.push("nombre es requerido");
    if (!categoria) errors.push("categoria es requerida");
    if (nombre && (nombre.length < 3 || nombre.length > 100)) {
      errors.push("nombre debe tener entre 3 y 100 caracteres");
    }
    if (categoria && (categoria.length < 2 || categoria.length > 50)) {
      errors.push("categoria debe tener entre 2 y 50 caracteres");
    }
    if (esvendible !== undefined && typeof esvendible !== "boolean") {
      errors.push("esvendible debe ser booleano");
    }

    let parsedCodigoList = codigoList ?? codigos ?? null;
    if (parsedCodigoList === null && codigo !== undefined) {
      parsedCodigoList = [{ codigo_barras_ean: codigo, nota: null }];
    }

    if (!Array.isArray(parsedCodigoList) || parsedCodigoList.length === 0) {
      errors.push("codigoList debe contener al menos un código");
    } else {
      parsedCodigoList.forEach((item, index) => {
        const value = item && typeof item === "object" ? item.codigo_barras_ean : item;
        if (value === undefined || value === null || String(value).trim() === "") {
          errors.push(`codigoList[${index}].codigo_barras_ean es requerido`);
        }
      });
    }

    if (errors.length > 0) {
      throwError("Datos inválidos", 400, errors);
    }

    const servicioData = {
      nombre,
      categoria,
      esvendible: esvendible !== undefined ? esvendible : true,
      nota: nota || null,
    };

    const newServicio = await servicioService.createServicio(
      servicioData,
      servicioTiendaList,
      ofertaList,
      parsedCodigoList
    );

    res.status(201).json({
      message: "Servicio creado exitosamente",
      data: newServicio,
    });
  } catch (error) {
    handleError(res, error);
  }
};

const filterServicios = async (req, res) => {
  try {
    const { limit, page, fetchProducto, tienda_nombre, id_tienda, ...filters } = req.query;

    let limitNum = parseInt(limit, 10) || 10;
    if (isNaN(limitNum) || limitNum < 1) {
      throwError("El parámetro 'limit' debe ser un número entero positivo", 400);
    }

    let pageNum = parseInt(page, 10) || 1;
    if (isNaN(pageNum) || pageNum < 1) {
      throwError("El parámetro 'page' debe ser un número entero positivo", 400);
    }

    const allowedFilters = ["nombre", "codigo", "categoria", "esvendible"];
    const filterCriteria = {};
    for (const key of allowedFilters) {
      if (filters[key] !== undefined) {
        filterCriteria[key] = filters[key];
      }
    }

    if (filterCriteria.esvendible !== undefined) {
      if (filterCriteria.esvendible === "true") filterCriteria.esvendible = true;
      else if (filterCriteria.esvendible === "false") filterCriteria.esvendible = false;
      else if (typeof filterCriteria.esvendible !== "boolean") {
        throwError("El filtro 'esvendible' debe ser true o false", 400);
      }
    }

    let includeProductos = false;
    if (fetchProducto !== undefined) {
      if (fetchProducto === "true") includeProductos = true;
      else if (fetchProducto === "false") includeProductos = false;
      else if (typeof fetchProducto !== "boolean") {
        throwError("El filtro 'fetchProducto' debe ser true o false", 400);
      } else {
        includeProductos = fetchProducto;
      }
    }

    let parsedIdTienda;
    if (id_tienda !== undefined) {
      parsedIdTienda = parseInt(id_tienda, 10);
      if (isNaN(parsedIdTienda) || parsedIdTienda < 1) {
        throwError("El parámetro 'id_tienda' debe ser un número entero positivo", 400);
      }
    }

    const offset = (pageNum - 1) * limitNum;
    const { rows: servicios, count: total } = await servicioService.filterServicios(
      filterCriteria,
      tienda_nombre,
      parsedIdTienda,
      includeProductos,
      limitNum,
      offset
    );

    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      data: servicios,
      pagination: {
        currentPage: pageNum,
        limit: limitNum,
        totalPages,
        totalItems: total,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};

const getServicioById = async (req, res) => {
  try {
    const { id } = req.params;
    const servicio = await servicioService.getServicioById(id);
    res.status(200).json(servicio);
  } catch (error) {
    handleError(res, error);
  }
};

const getServicioByCodigo = async (req, res) => {
  try {
    const { codigo } = req.params;
    const servicio = await servicioService.getServicioByCodigo(codigo);
    res.status(200).json(servicio);
  } catch (error) {
    handleError(res, error);
  }
};

const updateServicio = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      categoria,
      esvendible,
      nota,
      servicioTiendaList,
      ofertaList,
      codigoList,
      codigos,
      codigo,
    } = req.body;

    const errors = [];
    if (Object.keys(req.body).length === 0) {
      throwError("Se debe proporcionar al menos un campo para actualizar", 400);
    }

    if (nombre !== undefined && (nombre.length < 3 || nombre.length > 100)) {
      errors.push("nombre debe tener entre 3 y 100 caracteres");
    }
    if (categoria !== undefined && (categoria.length < 2 || categoria.length > 50)) {
      errors.push("categoria debe tener entre 2 y 50 caracteres");
    }
    if (esvendible !== undefined && typeof esvendible !== "boolean") {
      errors.push("esvendible debe ser booleano");
    }

    let parsedCodigoList = codigoList ?? codigos ?? undefined;
    if (parsedCodigoList === undefined && codigo !== undefined) {
      parsedCodigoList = [{ codigo_barras_ean: codigo, nota: null }];
    }

    if (parsedCodigoList !== undefined) {
      if (!Array.isArray(parsedCodigoList) || parsedCodigoList.length === 0) {
        errors.push("codigoList debe contener al menos un código");
      } else {
        parsedCodigoList.forEach((item, index) => {
          const value = item && typeof item === "object" ? item.codigo_barras_ean : item;
          if (value === undefined || value === null || String(value).trim() === "") {
            errors.push(`codigoList[${index}].codigo_barras_ean es requerido`);
          }
        });
      }
    }

    if (errors.length > 0) {
      throwError("Datos inválidos", 400, errors);
    }

    const servicioData = {};
    if (nombre !== undefined) servicioData.nombre = nombre;
    if (categoria !== undefined) servicioData.categoria = categoria;
    if (esvendible !== undefined) servicioData.esvendible = esvendible;
    if (nota !== undefined) servicioData.nota = nota;

    const updatedServicio = await servicioService.updateServicio(
      id,
      servicioData,
      servicioTiendaList,
      ofertaList,
      parsedCodigoList
    );

    res.status(200).json({
      message: "Servicio actualizado correctamente",
      data: updatedServicio,
    });
  } catch (error) {
    handleError(res, error);
  }
};

const deleteServicio = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await servicioService.deleteServicio(id);
    res.status(200).json({
      message: "Servicio y sus relaciones eliminados correctamente",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

module.exports = {
  createServicio,
  filterServicios,
  getServicioById,
  getServicioByCodigo,
  updateServicio,
  deleteServicio
};