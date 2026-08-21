const cuentaService = require("../services/cuentaService");
const { throwError } = require("../helpers/errorLauncher");
const { tiposCuenta } = require("../models/cuenta");

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

const createCuenta = async (req, res) => {
  try {
    const { nombre, tipo_cuenta, num_cuenta, nota } = req.body;

    const errors = [];
    if (!nombre) errors.push("El campo nombre es obligatorio.");
    if (!tipo_cuenta) errors.push("El campo tipo_cuenta es obligatorio.");
    if (nombre && (nombre.length < 1 || nombre.length > 100)) {
      errors.push("El nombre debe tener entre 1 y 100 caracteres.");
    }
    if (tipo_cuenta && !tiposCuenta.includes(tipo_cuenta)) {
      errors.push(`El tipo de cuenta debe ser uno de: ${tiposCuenta.join(", ")}.`);
    }
    if (num_cuenta !== undefined && num_cuenta !== null && num_cuenta !== "") {
      if (num_cuenta.length < 12 || num_cuenta.length > 16) {
        errors.push("El número de cuenta debe tener entre 12 y 16 caracteres.");
      }
    }
    if (nota !== undefined && nota !== null && nota.length > 255) {
      errors.push("La nota no puede exceder 255 caracteres.");
    }

    if (errors.length > 0) {
      throwError("Datos inválidos", 400, errors);
    }

    const cuentaData = {
      nombre,
      tipo_cuenta,
      num_cuenta: num_cuenta || null,
      nota: nota || null,
      // fondo NO se recibe aquí
    };

    const newCuenta = await cuentaService.createCuenta(cuentaData);
    res.status(201).json({
      message: "Cuenta creada exitosamente",
      data: newCuenta,
    });
  } catch (error) {
    handleError(res, error);
  }
};

const getCuentaById = async (req, res) => {
  try {
    const { id } = req.params;
    const cuenta = await cuentaService.getCuentaById(id);
    res.status(200).json(cuenta);
  } catch (error) {
    handleError(res, error);
  }
};

const updateCuenta = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, tipo_cuenta, num_cuenta, nota } = req.body;

    if (Object.keys(req.body).length === 0) {
      throwError("Se debe proporcionar al menos un campo para actualizar.", 400);
    }

    const errors = [];
    if (nombre !== undefined && (nombre.length < 1 || nombre.length > 100)) {
      errors.push("El nombre debe tener entre 1 y 100 caracteres.");
    }
    if (tipo_cuenta !== undefined && !tiposCuenta.includes(tipo_cuenta)) {
      errors.push(`El tipo de cuenta debe ser uno de: ${tiposCuenta.join(", ")}.`);
    }
    if (num_cuenta !== undefined && num_cuenta !== null && num_cuenta !== "") {
      if (num_cuenta.length < 12 || num_cuenta.length > 16) {
        errors.push("El número de cuenta debe tener entre 12 y 16 caracteres.");
      }
    }
    if (nota !== undefined && nota !== null && nota.length > 255) {
      errors.push("La nota no puede exceder 255 caracteres.");
    }

    if (errors.length > 0) {
      throwError("Datos inválidos", 400, errors);
    }

    const updateData = {};
    if (nombre !== undefined) updateData.nombre = nombre;
    if (tipo_cuenta !== undefined) updateData.tipo_cuenta = tipo_cuenta;
    if (num_cuenta !== undefined) updateData.num_cuenta = num_cuenta || null;
    if (nota !== undefined) updateData.nota = nota || null;
    // fondo no se incluye, el servicio lo ignora

    const updated = await cuentaService.updateCuenta(id, updateData);
    res.status(200).json({
      message: "Cuenta actualizada correctamente",
      data: updated,
    });
  } catch (error) {
    handleError(res, error);
  }
};

const deleteCuenta = async (req, res) => {
  try {
    const { id } = req.params;
    await cuentaService.deleteCuenta(id);
    res.status(200).json({ message: "Cuenta eliminada correctamente" });
  } catch (error) {
    handleError(res, error);
  }
};

const filterCuentas = async (req, res) => {
  try {
    const { limit, page, nombre, tipo_cuenta, num_cuenta } = req.query;

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
    if (tipo_cuenta) filters.tipo_cuenta = tipo_cuenta.trim();
    if (num_cuenta) filters.num_cuenta = num_cuenta.trim();

    const offset = (pageNum - 1) * limitNum;
    const { rows, count } = await cuentaService.filterCuentas(filters, limitNum, offset);

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
  createCuenta,
  getCuentaById,
  updateCuenta,
  deleteCuenta,
  filterCuentas,
};