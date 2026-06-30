/* global process */
const usuarioService = require("../services/usuarioService");
const bcrypt = require("bcrypt");
const { roles } = require("../models/usuario");
const jwt = require("jsonwebtoken");
const { throwError } = require("../helpers/errorLauncher");

// Función auxiliar para responder errores
const handleError = (res, error) => {
  const status = error.status || 500;
  const message = error.message || "Error interno del servidor";
  let errors = error.errors;
  if (!Array.isArray(errors) || errors.length === 0) {
    errors = [message];
  }
  // Asegurar que cada error sea string
  errors = errors.map(e => typeof e === 'string' ? e : String(e));
  res.status(status).json({ errors });
};

// GET /usuario/:id
const getUsuarioById = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = await usuarioService.getUsuarioById(id);
    res.status(200).json(usuario);
  } catch (error) {
    handleError(res, error);
  }
};

// POST /usuario (crear)
const createUsuario = async (req, res) => {
  try {
    const { nombre_natural, nombre_usuario, contrasenna, rol, salario_diario, activo, telefono, direccion } = req.body;
    const errors = [];

    // Validaciones
    if (!nombre_natural) errors.push("nombre_natural es requerido");
    if (!nombre_usuario) errors.push("nombre_usuario es requerido");
    if (!contrasenna) errors.push("contrasenna es requerida");
    if (!rol) errors.push("rol es requerido");

    if (nombre_natural && (nombre_natural.length < 3 || nombre_natural.length > 50)) {
      errors.push("nombre_natural debe tener entre 3 y 50 caracteres");
    }
    if (nombre_usuario && (nombre_usuario.length < 4 || nombre_usuario.length > 20)) {
      errors.push("nombre_usuario debe tener entre 4 y 20 caracteres");
    }
    if (contrasenna && contrasenna.length < 6) {
      errors.push("contrasenna debe tener al menos 6 caracteres");
    }
    if (rol && !roles.includes(rol)) {
      errors.push(`rol debe ser uno de: ${roles.join(", ")}`);
    }
    if (salario_diario !== undefined && (isNaN(salario_diario) || salario_diario < 0)) {
      errors.push("salario_diario debe ser un número positivo");
    }

    if (errors.length > 0) {
      throwError("Datos inválidos", 400, errors);
    }

    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(contrasenna, 10);

    const usuarioData = {
      nombre_natural,
      nombre_usuario,
      contrasenna: hashedPassword,
      rol,
      salario_diario: salario_diario || 0,
      activo: activo !== undefined ? activo : true,
      telefono,
      direccion,
    };

    const newUsuario = await usuarioService.createUsuario(usuarioData);
    res.status(201).json({
      message: "Usuario creado exitosamente",
      data: {
        id_usuario: newUsuario.id_usuario,
        nombre_natural: newUsuario.nombre_natural,
        nombre_usuario: newUsuario.nombre_usuario,
        rol: newUsuario.rol,
        activo: newUsuario.activo,
        salario_diario: newUsuario.salario_diario,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};

// PUT /usuario/:id
const updateUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre_natural, nombre_usuario, contrasenna, rol, salario_diario, activo, telefono, direccion } = req.body;
    const errors = [];

    if (Object.keys(req.body).length === 0) {
      throwError("Se debe proporcionar al menos un campo para actualizar", 400);
    }

    // Validaciones
    if (nombre_natural && (nombre_natural.length < 3 || nombre_natural.length > 50)) {
      errors.push("nombre_natural debe tener entre 3 y 50 caracteres");
    }
    if (nombre_usuario && (nombre_usuario.length < 4 || nombre_usuario.length > 20)) {
      errors.push("nombre_usuario debe tener entre 4 y 20 caracteres");
    }
    if (contrasenna && contrasenna.length < 6) {
      errors.push("contrasenna debe tener al menos 6 caracteres");
    }
    if (rol && !roles.includes(rol)) {
      errors.push(`rol debe ser uno de: ${roles.join(", ")}`);
    }
    if (salario_diario !== undefined && (isNaN(salario_diario) || salario_diario < 0)) {
      errors.push("salario_diario debe ser un número positivo");
    }

    if (errors.length > 0) {
      throwError("Datos inválidos", 400, errors);
    }

    const userData = {};
    if (nombre_natural !== undefined) userData.nombre_natural = nombre_natural;
    if (nombre_usuario !== undefined) userData.nombre_usuario = nombre_usuario;
    if (rol !== undefined) userData.rol = rol;
    if (salario_diario !== undefined) userData.salario_diario = salario_diario;
    if (activo !== undefined) userData.activo = activo;
    if (telefono !== undefined) userData.telefono = telefono;
    if (direccion !== undefined) userData.direccion = direccion;

    if (contrasenna) {
      userData.contrasenna = await bcrypt.hash(contrasenna, 10);
    }

    const usuarioActualizado = await usuarioService.updateUsuario(id, userData);
    res.status(200).json({
      message: "Usuario actualizado correctamente",
      data: usuarioActualizado,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// DELETE /usuario/:id
const deleteUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    await usuarioService.deleteUsuario(id);
    res.status(200).json({ message: "Usuario eliminado correctamente" });
  } catch (error) {
    handleError(res, error);
  }
};

// GET /usuario/filter (con query params)
const filterUsuarios = async (req, res) => {
  try {
    const { limit, page, ...filters } = req.query;

    // Establecer valores por defecto: limit = 10, page = 1
    let limitNum = parseInt(limit, 10) || 10; // Si no viene, usamos 10
    if (isNaN(limitNum) || limitNum < 1) {
      throwError("El parámetro 'limit' debe ser un número entero positivo", 400);
    }

    let pageNum = parseInt(page, 10) || 1;
    if (isNaN(pageNum) || pageNum < 1) {
      throwError("El parámetro 'page' debe ser un número entero positivo", 400);
    }

    // Construir objeto de filtros (solo los campos permitidos)
    const allowedFilters = ["nombre_natural", "nombre_usuario", "rol", "activo"];
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

    // Llamar al servicio con los parámetros de paginación
    const { rows: usuarios, count: total } = await usuarioService.filterUsuarios(
      filterCriteria,
      limitNum,
      offset
    );

    const totalPages = Math.ceil(total / limitNum);

    // Construir la respuesta con paginación siempre
    const response = {
      data: usuarios,
      pagination: {
        currentPage: pageNum,
        limit: limitNum,
        totalPages,
        totalItems: total
      }
    };

    res.status(200).json(response);
  } catch (error) {
    handleError(res, error);
  }
};

// Función auxiliar para construir la query string de filtros (excluyendo limit y page)
function buildQueryString(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value);
    }
  }
  const query = params.toString();
  return query ? `&${query}` : '';
}

// Función auxiliar para construir la query string de filtros (excluyendo limit y page)
function buildQueryString(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value);
    }
  }
  const query = params.toString();
  return query ? `&${query}` : '';
}

// POST /usuario/login
const login = async (req, res) => {
  try {
    const { nombre_usuario, contrasenna } = req.body;
    if (!nombre_usuario || !contrasenna) {
      throwError("nombre_usuario y contrasenna son requeridos", 400);
    }

    const usuario = await usuarioService.getUsuarioByNombreUsuario(nombre_usuario);
    if (!usuario) {
      throwError("Usuario no encontrado", 404);
    }

    const isValid = await bcrypt.compare(contrasenna, usuario.contrasenna);
    if (!isValid) {
      throwError("Contraseña incorrecta", 401);
    }

    const token = jwt.sign(
      {
        userId: usuario.id_usuario,
        nombre: usuario.nombre_natural,
        nombre_usuario: usuario.nombre_usuario,
        rol: usuario.rol,
        salario_diario: usuario.salario_diario,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    const refreshToken = jwt.sign(
      { userId: usuario.id_usuario },
      process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(200).json({
      usuario: {
        id_usuario: usuario.id_usuario,
        nombre_natural: usuario.nombre_natural,
        nombre_usuario: usuario.nombre_usuario,
        rol: usuario.rol,
        salario_diario: usuario.salario_diario,
        activo: usuario.activo,
      },
      token,
      refreshToken,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// POST /usuario/changePassword (requiere token)
const changePassword = async (req, res) => {
  try {
    const { viejaContrasenna, nuevaContrasenna } = req.body;
    if (!viejaContrasenna || !nuevaContrasenna) {
      throwError("viejaContrasenna y nuevaContrasenna son requeridas", 400);
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throwError("Token no proporcionado o inválido", 403);
    }
    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      throwError("Token inválido o expirado", 403);
    }

    const userId = decoded.userId || decoded.id_usuario;
    if (!userId) {
      throwError("Token sin userId válido", 403);
    }

    const usuario = await usuarioService.getUsuarioById(userId);
    if (!usuario) {
      throwError("Usuario no encontrado", 404);
    }

    const isValid = await bcrypt.compare(viejaContrasenna, usuario.contrasenna);
    if (!isValid) {
      throwError("Contraseña actual incorrecta", 401);
    }

    if (nuevaContrasenna.length < 6) {
      throwError("La nueva contraseña debe tener al menos 6 caracteres", 400);
    }

    const hashed = await bcrypt.hash(nuevaContrasenna, 10);
    await usuario.update({ contrasenna: hashed });

    res.status(200).json({ message: "Contraseña actualizada correctamente" });
  } catch (error) {
    handleError(res, error);
  }
};

module.exports = {
  getUsuarioById,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  filterUsuarios,
  login,
  changePassword,
};