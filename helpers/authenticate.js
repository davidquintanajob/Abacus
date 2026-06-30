/* global process */
require('dotenv').config();
const jwt = require("jsonwebtoken");

const authenticate = (...allowedRoles) => { // Acepta una lista de roles, por defecto vacía
  return function (req, res, next) {
    if (String(process.env.ENVIRONMENT) !== "development") {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(403).json({ message: 'Necesita iniciar sesión para acceder a este recurso.' });
      }
      try {
        const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

        // Extraer datos del usuario del token decodificado
        req.userData = {
          userId: decodedToken.id_usuario,
          nombre: decodedToken.nombre,
          nombre_usuario: decodedToken.nombre_usuario,
          rol: decodedToken.rol // Obtener el rol del usuario
        };

        // Verificar roles si la lista de roles permitidos no está vacía
        if (allowedRoles.length > 0) {
          if (!allowedRoles.includes(req.userData.rol)) {
            // Si el rol del usuario no está en la lista de roles permitidos
            return res.status(403).json({ message: `No tiene permiso para acceder a este recurso como ${req.userData.rol}` });
          }
        }

        // Si la lista de roles permitidos está vacía o el rol coincide, continuar
        next();

      } catch (error) {
        console.error("Error en la autenticación:", error.message);
        return res.status(403).json({ message: 'Token inválido o expirado. Permiso denegado.' });
      }
    } else {
      next();
    }
  };
};

module.exports = authenticate;
