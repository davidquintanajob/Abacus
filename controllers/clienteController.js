const clienteService = require("../services/clienteService");
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

const getClienteById = async (req, res) => {
  try {
    const { id } = req.params;
    const cliente = await clienteService.getClienteById(id);
    res.status(200).json(cliente);
  } catch (error) {
    handleError(res, error);
  }
};

const createCliente = async (req, res) => {
  try {
    const {
      nombre,
      nota,
      direccion,
      telefono,
      localizacion_coordenadas_gps,
      tipo_cliente,
      descuento,
    } = req.body;

    const errors = [];
    if (!nombre || nombre.trim() === "") errors.push("nombre es obligatorio.");
    if (nombre && (nombre.length < 1 || nombre.length > 150)) {
      errors.push("nombre debe tener entre 1 y 150 caracteres.");
    }
    if (nota !== undefined && nota !== null && nota.length > 255) {
      errors.push("nota no puede exceder 255 caracteres.");
    }
    if (direccion !== undefined && direccion !== null && direccion.length > 255) {
      errors.push("direccion no puede exceder 255 caracteres.");
    }
    if (telefono !== undefined && telefono !== null && telefono.length > 30) {
      errors.push("telefono no puede exceder 30 caracteres.");
    }
    if (localizacion_coordenadas_gps !== undefined && localizacion_coordenadas_gps !== null && localizacion_coordenadas_gps.length > 100) {
      errors.push("localizacion_coordenadas_gps no puede exceder 100 caracteres.");
    }
    if (tipo_cliente !== undefined && tipo_cliente !== null && tipo_cliente.length > 50) {
      errors.push("tipo_cliente no puede exceder 50 caracteres.");
    }
    if (descuento !== undefined && descuento !== null && descuento.length > 50) {
      errors.push("descuento no puede exceder 50 caracteres.");
    }

    if (errors.length > 0) {
      throwError("Datos inválidos", 400, errors);
    }

    const clienteData = {
      nombre: nombre.trim(),
      nota: nota || null,
      direccion: direccion || null,
      telefono: telefono || null,
      localizacion_coordenadas_gps: localizacion_coordenadas_gps || null,
      tipo_cliente: tipo_cliente || null,
      descuento: descuento || null,
    };

    const newCliente = await clienteService.createCliente(clienteData);
    res.status(201).json({
      message: "Cliente creado exitosamente",
      data: newCliente,
    });
  } catch (error) {
    handleError(res, error);
  }
};

const updateCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      nota,
      direccion,
      telefono,
      localizacion_coordenadas_gps,
      tipo_cliente,
      descuento,
    } = req.body;

    if (Object.keys(req.body).length === 0) {
      throwError("Se debe proporcionar al menos un campo para actualizar.", 400);
    }

    const errors = [];
    if (nombre !== undefined && (nombre.trim() === "" || nombre.length < 1 || nombre.length > 150)) {
      errors.push("nombre debe tener entre 1 y 150 caracteres.");
    }
    if (nota !== undefined && nota !== null && nota.length > 255) {
      errors.push("nota no puede exceder 255 caracteres.");
    }
    if (direccion !== undefined && direccion !== null && direccion.length > 255) {
      errors.push("direccion no puede exceder 255 caracteres.");
    }
    if (telefono !== undefined && telefono !== null && telefono.length > 30) {
      errors.push("telefono no puede exceder 30 caracteres.");
    }
    if (localizacion_coordenadas_gps !== undefined && localizacion_coordenadas_gps !== null && localizacion_coordenadas_gps.length > 100) {
      errors.push("localizacion_coordenadas_gps no puede exceder 100 caracteres.");
    }
    if (tipo_cliente !== undefined && tipo_cliente !== null && tipo_cliente.length > 50) {
      errors.push("tipo_cliente no puede exceder 50 caracteres.");
    }
    if (descuento !== undefined && descuento !== null && descuento.length > 50) {
      errors.push("descuento no puede exceder 50 caracteres.");
    }

    if (errors.length > 0) {
      throwError("Datos inválidos", 400, errors);
    }

    const updateData = {};
    if (nombre !== undefined) updateData.nombre = nombre.trim();
    if (nota !== undefined) updateData.nota = nota || null;
    if (direccion !== undefined) updateData.direccion = direccion || null;
    if (telefono !== undefined) updateData.telefono = telefono || null;
    if (localizacion_coordenadas_gps !== undefined) updateData.localizacion_coordenadas_gps = localizacion_coordenadas_gps || null;
    if (tipo_cliente !== undefined) updateData.tipo_cliente = tipo_cliente || null;
    if (descuento !== undefined) updateData.descuento = descuento || null;

    const updated = await clienteService.updateCliente(id, updateData);
    res.status(200).json({
      message: "Cliente actualizado correctamente",
      data: updated,
    });
  } catch (error) {
    handleError(res, error);
  }
};

const deleteCliente = async (req, res) => {
  try {
    const { id } = req.params;
    await clienteService.deleteCliente(id);
    res.status(200).json({ message: "Cliente eliminado correctamente" });
  } catch (error) {
    handleError(res, error);
  }
};

const filterClientes = async (req, res) => {
  try {
    const { limit, page, nombre, telefono, tipo_cliente } = req.query;

    let limitNum = parseInt(limit, 10) || 10;
    if (isNaN(limitNum) || limitNum < 1) {
      throwError("El parámetro 'limit' debe ser un número entero positivo.", 400);
    }
    let pageNum = parseInt(page, 10) || 1;
    if (isNaN(pageNum) || pageNum < 1) {
      throwError("El parámetro 'page' debe ser un número entero positivo.", 400);
    }

    const filters = {};
    if (nombre) filters.nombre = nombre.trim();
    if (telefono) filters.telefono = telefono.trim();
    if (tipo_cliente) filters.tipo_cliente = tipo_cliente.trim();

    const offset = (pageNum - 1) * limitNum;
    const { rows, count } = await clienteService.filterClientes(filters, limitNum, offset);

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

module.exports = {
  getClienteById,
  createCliente,
  updateCliente,
  deleteCliente,
  filterClientes,
};