/* global process */
const express = require("express");
const cors = require("cors");
const logger = require("./helpers/logger.js");
const { auditLogger } = require("./helpers/auditLogger");
const sequelize = require("./helpers/database.js");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const { throwError } = require("./helpers/errorLauncher"); // <-- Importar throwError
const { DataTypes } = require("sequelize");
const notifier = require("node-notifier"); // NUEVO: Notificaciones de escritorio
const http = require("http");
const { initSocket } = require("./helpers/socket");

// <-- NUEVO: Importar el gestor de licencias
const { SecureLicenseManager } = require("./helpers/SecureLicenseManager");

const app = express();

// ===== NUEVA FUNCIÓN PARA NOTIFICACIONES DE ESCRITORIO =====
function showDesktopNotification(licenseInfo) {
  // Solo ejecutar en Windows
  if (process.platform !== "win32") {
    console.log("🔔 Notificación de escritorio solo disponible en Windows");
    return;
  }

  const daysLeft = licenseInfo.daysLeft;
  let title = "🔒 Estado de Licencia API";
  let message = "";
  let sound = true;

  if (licenseInfo.error) {
    title = "❌ Error de Licencia";
    message = licenseInfo.errorMsg || "Error al verificar la licencia";
    sound = true;
  } else if (daysLeft != null) {
    if (daysLeft >= 0) {
      if (daysLeft <= 3) {
        title = "⚠️ Licencia por expirar (URGENTE)";
        message = `¡URGENTE! Quedan solo ${daysLeft} día(s) de licencia`;
        sound = true;
      } else if (daysLeft <= 7) {
        title = "⚠️ Licencia próxima a expirar";
        message = `Quedan ${daysLeft} día(s) de licencia. Considera renovar.`;
        sound = true;
      } else {
        title = "✅ Licencia Activa";
        message = `Licencia válida: quedan ${daysLeft} día(s)`;
        sound = false;
      }
    } else {
      title = "❌ Licencia Expirada";
      message = `Licencia expirada hace ${Math.abs(daysLeft)} día(s)`;
      sound = true;
    }
  } else {
    title = "⚠️ Información no disponible";
    message = "No se pudo obtener información de la licencia";
    sound = false;
  }

  // Ruta absoluta al icono (logo.png en la misma carpeta que app.js)
  const iconPath = path.join(__dirname, "logo.png");

  try {
    notifier.notify({
      title: title,
      message: message,
      sound: sound,
      wait: false,
      timeout: 10,
      icon: iconPath,
      appID: "API Licencia",
    });
  } catch (err) {
    console.error("❌ Error al mostrar la notificación:", err.message);
  }

  // También mostrar en consola
  console.log(`🔔 ${title}: ${message}`);
}
// ===== FIN DE LA NUEVA FUNCIÓN =====

// Middlewares básicos
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cors({
  origin: process.env.CORS_OPTIONS || "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Servir archivos estáticos (fotos si se usan)
app.use("/fotos", express.static(path.join(__dirname, "fotos")));
app.use("/imagenes_productos", express.static(path.join(__dirname, "imagenes_productos")));
app.use("/local_config_logo", express.static(path.join(__dirname, "local_config_logo")));

// Logger de solicitudes (simplificado)
app.use((req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;
  res.send = function (body) {
    const responseTime = Date.now() - startTime;
    logger.info({
      message: `${req.method} ${req.url}`,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip || req.connection.remoteAddress,
    });
    console.log(`${new Date().toISOString()} - ${res.statusCode} - ${req.method} ${req.url}`);
    return originalSend.call(this, body);
  };
  next();
});

// <-- NUEVO: Middleware de verificación de licencia en cada petición
app.use((req, res, next) => {
  const status = SecureLicenseManager.checkLicense();
  if (!status.isValid) {
    logger.warn(`Acceso denegado - Licencia inválida: ${status.message}`);
    return res.status(403).json({
      error: "Licencia inválida o expirada. Contacte al administrador.",
      detail: status.message
    });
  }
  next();
});

// ========== NUEVO MIDDLEWARE: VALIDACIÓN DE VERSIÓN DE APK ==========
app.use((req, res, next) => {
  // Obtener header (insensible a mayúsculas)
  const apkVersionHeader = req.headers['apk-version'] || req.headers['apk_version'];
  if (!apkVersionHeader) {
    // No se envió el header, continuar sin validar
    return next();
  }

  // Validar formato: debe ser x.x.x
  const versionPattern = /^\d+\.\d+\.\d+$/;
  if (!versionPattern.test(apkVersionHeader)) {
    throwError('Formato de versión de APK inválido. Debe ser x.x.x', 400);
  }

  // Obtener rango de versiones soportadas desde variable de entorno
  const supportRange = process.env.APK_SUPORT_VERSION;
  if (!supportRange) {
    // Si no está definida, emitimos warning y permitimos (o podemos denegar, pero elegimos permitir)
    console.warn('⚠️ Variable APK_SUPORT_VERSION no definida, omitiendo validación de versión');
    return next();
  }

  // Validar formato del rango: "x.x.x-y.y.y"
  const rangePattern = /^\d+\.\d+\.\d+-\d+\.\d+\.\d+$/;
  if (!rangePattern.test(supportRange)) {
    console.error('❌ Variable APK_SUPORT_VERSION con formato inválido. Debe ser x.x.x-y.y.y');
    throwError('Configuración de soporte de versiones inválida', 500);
  }

  const [rangeStart, rangeEnd] = supportRange.split('-');

  // Función de comparación semántica
  const compareVersions = (v1, v2) => {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if (parts1[i] !== parts2[i]) {
        return parts1[i] < parts2[i] ? -1 : 1;
      }
    }
    return 0;
  };

  const [minVersion, maxVersion] = compareVersions(rangeStart, rangeEnd) <= 0
    ? [rangeStart, rangeEnd]
    : [rangeEnd, rangeStart];
  const isGreaterOrEqual = compareVersions(apkVersionHeader, minVersion) >= 0;
  const isLessOrEqual = compareVersions(apkVersionHeader, maxVersion) <= 0;

  if (!isGreaterOrEqual || !isLessOrEqual) {
    const message = `La versión de la aplicación móvil (${apkVersionHeader}) no está soportada. Actualiza la aplicación para continuar. Versiones compatibles: ${supportRange}.`;
    logger.warn(`Acceso denegado por versión de APK no soportada: ${apkVersionHeader}`);
    return res.status(426).json({
      code: "APK_VERSION_UNSUPPORTED",
      errors: [message],
      versionActual: apkVersionHeader,
      versionesSoportadas: supportRange,
      actualizarAplicacion: true,
    });
  }

  // Si todo ok, continuar
  next();
});
// ================================================================

// ========== MIDDLEWARE DE AUTENTICACIÓN GLOBAL (opcional) ==========
// Intenta decodificar el token y asigna req.user si es válido.
// No bloquea si no hay token o es inválido.
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      const token = parts[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
      } catch (err) {
        // Token inválido, no asignamos req.user
        console.log('[Auth] Token inválido o expirado');
      }
    }
  }
  next();
});
// ================================================================

// ========== MIDDLEWARE DE AUDITORÍA ==========
app.use((req, res, next) => {

  let reqSizeBytes = 0;
  if (req.body) {
    try {
      if (typeof req.body === 'object') {
        reqSizeBytes = Buffer.byteLength(JSON.stringify(req.body), 'utf8');
      } else {
        reqSizeBytes = Buffer.byteLength(String(req.body), 'utf8');
      }
    } catch (e) {
      reqSizeBytes = 0;
    }
  }

  const originalSend = res.send;
  res.send = function (data) {

    let resSizeBytes = 0;
    if (data) {
      try {
        if (Buffer.isBuffer(data)) {
          resSizeBytes = data.length;
        } else if (typeof data === 'string') {
          resSizeBytes = Buffer.byteLength(data, 'utf8');
        } else if (typeof data === 'object') {
          resSizeBytes = Buffer.byteLength(JSON.stringify(data), 'utf8');
        } else {
          resSizeBytes = Buffer.byteLength(String(data), 'utf8');
        }
      } catch (e) {
        resSizeBytes = 0;
      }
    }

    let usuario = 'anonimo';
    if (req.user && typeof req.user === 'object') {
      const id = req.user.id || req.user.id_usuario || req.user.userId || '';
      const nombre = req.user.nombre || req.user.nombre_usuario || req.user.username || req.user.nombreUsuario || '';
      if (id || nombre) {
        usuario = `${id} (${nombre})`.trim();
        if (usuario === '()') usuario = 'anonimo';
      }
    }

    const endpoint = `${req.method} ${req.originalUrl || req.url || 'ruta_desconocida'}`;

    const logData = {
      usuario,
      endpoint,
      reqSize: reqSizeBytes / 1024,
      resSize: resSizeBytes / 1024,
    };

    auditLogger.info('Audit', logData);

    return originalSend.call(this, data);
  };

  next();
});
// =====================================================

// Configuración de Swagger
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "API de Gestión de Usuarios y Tiendas",
      version: "1.0.0",
      description: "API para administrar usuarios y tiendas",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./routes/*.js"],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs, {
  swaggerOptions: {
    docExpansion: "none",
    defaultModelsExpandDepth: -1,
    defaultModelExpandDepth: -1,
    tagsSorter: "alpha",
    operationsSorter: "alpha",
    persistAuthorization: true,
  },
}));

// Importar rutas
const servicioRoutes = require("./routes/servicioRoutes");
const productoRoutes = require("./routes/productoRoutes");
const usuarioRoutes = require("./routes/usuarioRoutes");
const tiendaRoutes = require("./routes/tiendaRoutes");
const configRoutes = require("./routes/configRoutes");
const entradaRoutes = require("./routes/entradaRoutes");
const salidaRoutes = require("./routes/salidaRoutes");
const cuentaRoutes = require("./routes/cuentaRoutes");
const operacionRoutes = require("./routes/operacionRoutes");
const clienteRoutes = require("./routes/clienteRoutes");
const listaVentaRoutes = require("./routes/listaVentaRoutes.js");
const informesRoutes = require("./routes/informesRoutes");
const movimientosRoutes = require("./routes/movimientoRoutes.js");
const deudaRoutes = require("./routes/deudaRoutes.js");
const notificacionRoutes = require("./routes/notificacionRoutes.js");

app.use("/", servicioRoutes);
app.use("/", productoRoutes);
app.use("/", usuarioRoutes);
app.use("/", tiendaRoutes);
app.use("/config", configRoutes);
app.use("/", entradaRoutes);
app.use("/", salidaRoutes);
app.use("/", cuentaRoutes);
app.use("/", operacionRoutes);
app.use("/", clienteRoutes);
app.use("/", listaVentaRoutes);
app.use("/", informesRoutes);
app.use("/", movimientosRoutes);
app.use("/", deudaRoutes);
app.use("/", notificacionRoutes);

// Inicializar la base de datos y arrancar el servidor
const startApp = async () => {
  try {
    // Crear carpetas necesarias
    const monedaDir = path.join(__dirname, "local_config");
    if (!fs.existsSync(monedaDir)) fs.mkdirSync(monedaDir, { recursive: true });
    const fotosDir = path.join(__dirname, "fotos");
    if (!fs.existsSync(fotosDir)) fs.mkdirSync(fotosDir, { recursive: true });
    ["servicio_complejo", "paciente", "consulta"].forEach((sub) => {
      const subDir = path.join(fotosDir, sub);
      if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
    });

    const logsDir = path.join(__dirname, "logs");
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

    // Importar modelos y establecer asociaciones
    const { Usuario } = require("./models/usuario");
    const { Tienda } = require("./models/tienda");
    const { Servicio } = require("./models/servicio");
    const { Producto } = require("./models/producto");
    const { ServicioTienda } = require("./models/servicio_tienda");
    const { Oferta } = require("./models/oferta");
    const { Codigo } = require("./models/codigo");
    const { Entrada } = require("./models/entrada");
    const { Fabricacion } = require("./models/fabricacion");
    const { FabricacionEntrada } = require("./models/fabricacion_entrada");
    const { FabricacionMovimiento } = require("./models/fabricacion_movimiento");
    const { Salida } = require("./models/salida.js");
    const { SalidaEntrada } = require("./models/salida_entrada.js");
    const { Cuenta } = require("./models/cuenta");
    const { Operacion } = require("./models/operacion");
    const { Venta } = require("./models/venta");
    const { Cliente } = require("./models/cliente");
    const { ListaVenta } = require("./models/lista_venta");
    const { VentaEntrada } = require("./models/venta_entrada");
    const { VentaMovimiento } = require("./models/venta_movimiento");
    const { MovimientoLista } = require("./models/movimiento_lista.js");
    const { Movimiento } = require("./models/movimiento.js");
    const { MovimientoEntrada } = require("./models/movimiento_entrada.js");
    const { MovimientoMovimiento } = require("./models/movimiento_movimiento.js");
    const { Deuda } = require("./models/deuda.js");
    const { PagoDeuda } = require("./models/pago_deuda.js");
    const { Notificacion } = require("./models/notificacion.js");

    const models = {
      Usuario,
      Tienda,
      Servicio,
      Producto,
      ServicioTienda,
      Oferta,
      Codigo,
      Entrada,
      Fabricacion,
      FabricacionEntrada,
      FabricacionMovimiento,
      Salida,
      SalidaEntrada,
      Cuenta,
      Operacion,
      Venta,
      Cliente,          // ✅ AGREGAR ESTO
      ListaVenta,
      VentaEntrada,
      VentaMovimiento,
      MovimientoLista,
      Movimiento,
      MovimientoEntrada,
      MovimientoMovimiento,
      Deuda,
      PagoDeuda,
      Notificacion
    };

    Object.values(models).forEach((model) => {
      if (typeof model.associate === "function") {
        model.associate(models);
      }
    });

    const [movimientoSchema] = await sequelize.query(`
      SELECT
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = current_schema() AND table_name = 'movimientos'
        ) AS table_exists,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'movimientos'
            AND column_name = 'cantidad_restante'
        ) AS remaining_column_exists
    `);
    if (movimientoSchema[0].table_exists && !movimientoSchema[0].remaining_column_exists) {
      await sequelize.query('ALTER TABLE "movimientos" ADD COLUMN "cantidad_restante" DOUBLE PRECISION');
      await sequelize.query('UPDATE "movimientos" SET "cantidad_restante" = "cantidad"');
    }

    await sequelize.sync({ alter: true });
    console.log("✅ Tablas sincronizadas correctamente");

    // ===== SECCIÓN MODIFICADA: VERIFICACIÓN DE LICENCIA AL INICIAR + NOTIFICACIÓN =====
    try {
      const licenseInfo = SecureLicenseManager.getLicenseInfo();
      const status = SecureLicenseManager.checkLicense();

      let daysLeft = null;

      // Prioridad 1: usar remainingDays del checkLicense (más confiable)
      if (status && typeof status.remainingDays !== "undefined" && status.remainingDays !== null) {
        daysLeft = Math.floor(Number(status.remainingDays));
      } else if (licenseInfo) {
        // Prioridad 2: buscar en distintas posibles claves del objeto licenseInfo
        const numericKeys = ['daysLeft', 'daysRemaining', 'remainingDays', 'dias_restantes', 'diasRestantes'];
        for (const k of numericKeys) {
          if (licenseInfo[k] != null && !isNaN(Number(licenseInfo[k]))) {
            daysLeft = Math.floor(Number(licenseInfo[k]));
            break;
          }
        }

        // Prioridad 3: calcular a partir de una fecha de expiración
        if (daysLeft === null) {
          const dateKeys = ['expiryDate', 'expirationDate', 'expiresAt', 'validUntil', 'valid_through', 'fecha_expiracion', 'vencimiento', 'expiration', 'expiry', 'endDate', 'end_date'];
          let dateStr = null;
          for (const k of dateKeys) {
            if (licenseInfo[k]) {
              dateStr = licenseInfo[k];
              break;
            }
          }
          if (!dateStr && licenseInfo.license && (licenseInfo.license.expiresAt || licenseInfo.license.expirationDate)) {
            dateStr = licenseInfo.license.expiresAt || licenseInfo.license.expirationDate;
          }
          if (dateStr) {
            const exp = new Date(dateStr);
            if (!isNaN(exp)) {
              const now = new Date();
              const diff = exp.getTime() - now.getTime();
              daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
            }
          }
        }
      }

      if (licenseInfo) {
        if (status.isValid) {
          console.log(`✅ Licencia válida - Días restantes: ${daysLeft}`);
          logger.info(`Licencia válida - Días restantes: ${daysLeft}`);
        } else {
          console.warn(`⚠️ ${status.message}`);
          logger.warn(`Licencia inválida: ${status.message}`);
        }

        // Mostrar notificación de escritorio con los días restantes
        showDesktopNotification({ daysLeft });
      } else {
        console.warn("⚠️ No se encontró archivo de licencia. La API funcionará pero las peticiones serán denegadas.");
        logger.warn("No se encontró archivo de licencia.");

        // Notificar el error de licencia
        showDesktopNotification({
          daysLeft: null,
          error: true,
          errorMsg: "No se encontró o no se pudo leer el archivo de licencia",
        });
      }
    } catch (err) {
      console.error("❌ Error al verificar la licencia inicial:", err);
      logger.error(`Error al verificar la licencia inicial: ${err.message}`);

      showDesktopNotification({
        daysLeft: null,
        error: true,
        errorMsg: err.message,
      });
    }
    // ===== FIN DE LA SECCIÓN MODIFICADA =====

    const PORT = process.env.PORT || 4000;
    const server = http.createServer(app);
    initSocket(server);
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
      console.log("🔌 Socket.IO inicializado. Los clientes autenticados pueden conectar con el token del login.");
      console.log(`📚 Documentación API: http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    console.error("❌ Error crítico al iniciar la aplicación:", error);
    process.exit(1);
  }
};

process.on("SIGINT", async () => {
  await sequelize.close();
  process.exit(0);
});

startApp();

module.exports = app;