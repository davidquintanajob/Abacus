const productoService = require("../services/productoService");
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

const createProducto = async (req, res) => {
  try {
    const {
      nombre,
      categoria,
      esvendible,
      nota,
      imagen,
      sufijo,
      isVencible,
      unidad_medida,
      productoTiendaList = [],
      codigoList,
      codigos,
      codigo,
    } = req.body;

    const errors = [];
    if (!nombre) errors.push("nombre es requerido");
    if (!categoria) errors.push("categoria es requerida");
    if (!sufijo) errors.push("sufijo es requerido");
    if (nombre && (nombre.length < 3 || nombre.length > 100)) {
      errors.push("nombre debe tener entre 3 y 100 caracteres");
    }
    if (categoria && (categoria.length < 2 || categoria.length > 50)) {
      errors.push("categoria debe tener entre 2 y 50 caracteres");
    }
    if (sufijo && (sufijo.length < 1 || sufijo.length > 50)) {
      errors.push("sufijo debe tener entre 1 y 50 caracteres");
    }
    if (esvendible !== undefined && typeof esvendible !== "boolean") {
      errors.push("esvendible debe ser booleano");
    }
    if (imagen !== undefined && typeof imagen !== "string") {
      errors.push("imagen debe ser un texto base64 o una URL");
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

    const productoData = {
      nombre,
      categoria,
      esvendible: esvendible !== undefined ? esvendible : true,
      nota: nota || null,
      imagen: imagen || null,
      sufijo,
      isVencible: isVencible !== undefined ? isVencible : false,
      unidad_medida: unidad_medida || null,
    };

    const newProducto = await productoService.createProducto(productoData, productoTiendaList, parsedCodigoList);

    res.status(201).json({
      message: "Producto creado exitosamente",
      data: newProducto,
    });
  } catch (error) {
    handleError(res, error);
  }
};

const getProductoById = async (req, res) => {
  try {
    const { id } = req.params;
    const producto = await productoService.getProductoById(id);
    res.status(200).json(producto);
  } catch (error) {
    handleError(res, error);
  }
};

const getProductosEnAlerta = async (req, res) => {
  try {
    const { id_tienda } = req.query;

    let parsedIdTienda;
    if (id_tienda !== undefined) {
      parsedIdTienda = parseInt(id_tienda, 10);
      if (isNaN(parsedIdTienda) || parsedIdTienda < 1) {
        throwError("El parámetro 'id_tienda' debe ser un número entero positivo", 400);
      }
    }

    const productos = await productoService.getProductosEnAlerta(parsedIdTienda);
    res.status(200).json(productos);
  } catch (error) {
    handleError(res, error);
  }
};

const filterProductos = async (req, res) => {
  try {
    const { limit, page, id_tienda, cantidad_min, cantidad_max, ...filters } = req.query;

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

    let parsedIdTienda;
    if (id_tienda !== undefined) {
      parsedIdTienda = parseInt(id_tienda, 10);
      if (isNaN(parsedIdTienda) || parsedIdTienda < 1) {
        throwError("El parámetro 'id_tienda' debe ser un número entero positivo", 400);
      }
    }

    let parsedCantidadMin;
    if (cantidad_min !== undefined) {
      parsedCantidadMin = parseFloat(cantidad_min);
      if (isNaN(parsedCantidadMin)) {
        throwError("El parámetro 'cantidad_min' debe ser numérico", 400);
      }
    }

    let parsedCantidadMax;
    if (cantidad_max !== undefined) {
      parsedCantidadMax = parseFloat(cantidad_max);
      if (isNaN(parsedCantidadMax)) {
        throwError("El parámetro 'cantidad_max' debe ser numérico", 400);
      }
    }

    if (parsedCantidadMin !== undefined && parsedCantidadMax !== undefined && parsedCantidadMin > parsedCantidadMax) {
      throwError("'cantidad_min' no puede ser mayor que 'cantidad_max'", 400);
    }

    const offset = (pageNum - 1) * limitNum;
    const { rows: productos, count: total } = await productoService.filterProductos(
      filterCriteria,
      parsedIdTienda,
      parsedCantidadMin,
      parsedCantidadMax,
      limitNum,
      offset
    );

    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      data: productos,
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

const updateProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      categoria,
      esvendible,
      nota,
      imagen,
      sufijo,
      isVencible,
      unidad_medida,
      productoTiendaList,
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
    if (sufijo !== undefined && (sufijo.length < 1 || sufijo.length > 50)) {
      errors.push("sufijo debe tener entre 1 y 50 caracteres");
    }
    if (esvendible !== undefined && typeof esvendible !== "boolean") {
      errors.push("esvendible debe ser booleano");
    }
    if (imagen !== undefined && typeof imagen !== "string") {
      errors.push("imagen debe ser un texto base64 o una URL");
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

    const productoData = {};
    if (nombre !== undefined) productoData.nombre = nombre;
    if (categoria !== undefined) productoData.categoria = categoria;
    if (esvendible !== undefined) productoData.esvendible = esvendible;
    if (nota !== undefined) productoData.nota = nota;
    if (imagen !== undefined) productoData.imagen = imagen;
    if (sufijo !== undefined) productoData.sufijo = sufijo;
    if (isVencible !== undefined) productoData.isVencible = isVencible;
    if (unidad_medida !== undefined) productoData.unidad_medida = unidad_medida;

    const updatedProducto = await productoService.updateProducto(id, productoData, productoTiendaList, parsedCodigoList);
    res.status(200).json({
      message: "Producto actualizado correctamente",
      data: updatedProducto,
    });
  } catch (error) {
    handleError(res, error);
  }
};

/** NUEVO: Eliminar producto */
const deleteProducto = async (req, res) => {
  try {
    const { id } = req.params;
    await productoService.deleteProducto(id);
    res.status(200).json({ message: "Producto eliminado correctamente" });
  } catch (error) {
    handleError(res, error);
  }
};

const getSeguimientoInventario = async (req, res) => {
  try {
    const { id } = req.params;
    const { id_tienda, fecha_desde, fecha_hasta } = req.query;

    const errors = [];
    if (id_tienda === undefined) errors.push("id_tienda es requerido");
    if (!fecha_desde) errors.push("fecha_desde es requerido");
    if (!fecha_hasta) errors.push("fecha_hasta es requerido");

    const idServicio = parseInt(id, 10);
    if (isNaN(idServicio) || idServicio < 1) {
      errors.push("El id del producto debe ser un número entero positivo");
    }

    let parsedIdTienda;
    if (id_tienda !== undefined) {
      parsedIdTienda = parseInt(id_tienda, 10);
      if (isNaN(parsedIdTienda) || parsedIdTienda < 1) {
        errors.push("'id_tienda' debe ser un número entero positivo");
      }
    }

    if (errors.length > 0) {
      throwError("Datos inválidos", 400, errors);
    }

    const result = await productoService.getSeguimientoInventario(
      idServicio,
      parsedIdTienda,
      fecha_desde,
      fecha_hasta
    );

    res.status(200).json(result);
  } catch (error) {
    handleError(res, error);
  }
};

module.exports = {
  createProducto,
  getProductoById,
  getProductosEnAlerta,
  filterProductos,
  updateProducto,
  deleteProducto,
  getSeguimientoInventario,
};