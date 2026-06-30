const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_OPTIONS || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    },
  });

  // Middleware de autenticación
  io.use((socket, next) => {
    try {
      console.log('[Socket.IO] Nueva conexión entrante, verificando token...');
      
      const token =
        (socket.handshake.auth && socket.handshake.auth.token) ||
        (socket.handshake.query && socket.handshake.query.token);

      if (!token) {
        console.log('[Socket.IO] Error: Token no proporcionado');
        return next(new Error('Token de autenticación no proporcionado en Socket.IO'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = {
        userId: decoded.userId || decoded.id_usuario,
        nombre: decoded.nombre,
        nombre_usuario: decoded.nombre_usuario,
        rol: decoded.rol,
      };

      if (!socket.user.userId) {
        console.log('[Socket.IO] Error: Token no contiene userId válido', decoded);
        return next(new Error('Token de Socket.IO sin userId válido'));
      }

      return next();
    } catch (error) {
      console.log('[Socket.IO] Error al verificar token:', error.message);
      return next(new Error('Token de Socket.IO inválido o expirado'));
    }
  });

  // Evento de conexión establecida
  io.on('connection', (socket) => {
    const { userId } = socket.user || {};
    
    if (userId) {
      const room = `user:${userId}`;
      socket.join(room);
      console.log(`[Socket.IO] Usuario ${userId} conectado. Socket ID: ${socket.id} -> Unido a sala: ${room}`);
    } else {
      console.log(`[Socket.IO] Socket ${socket.id} conectado pero sin usuario (esto no debería pasar si el middleware funciona)`);
    }

    // Opcional: Escuchar desconexión
    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Usuario ${userId || 'desconocido'} (socket ${socket.id}) se ha desconectado`);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.IO no ha sido inicializado');
  }
  return io;
}

module.exports = {
  initSocket,
  getIO,
};