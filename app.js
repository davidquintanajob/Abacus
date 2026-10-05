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

// <-- NUEVO: Importar el gestor de licencias
const { SecureLicenseManager } = require("./helpers/SecureLicenseManager");

const app = express();

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

  const [minVersion, maxVersion] = supportRange.split('-');

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

  const isGreaterOrEqual = compareVersions(apkVersionHeader, minVersion) >= 0;
  const isLessOrEqual = compareVersions(apkVersionHeader, maxVersion) <= 0;

  if (!isGreaterOrEqual || !isLessOrEqual) {
    throwError(
      `Versión de APK no soportada. Versión actual: ${apkVersionHeader}. Versiones soportadas: ${supportRange}`,
      400
    );
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
    const { Salida } = require("./models/salida.js");
    const { SalidaEntrada } = require("./models/salida_entrada.js");
    const { Cuenta } = require("./models/cuenta");
    const { Operacion } = require("./models/operacion");
    const { Venta } = require("./models/venta");
    const { Cliente } = require("./models/cliente");
    const { ListaVenta } = require("./models/lista_venta");
    const { VentaEntrada } = require("./models/venta_entrada");
    const { MovimientoLista } = require("./models/movimiento_lista.js");
    const { Movimiento } = require("./models/movimiento.js");
    const { MovimientoEntrada } = require("./models/movimiento_entrada.js");
    const { Deuda } = require("./models/deuda.js");
    const { PagoDeuda } = require("./models/pago_deuda.js");

    const models = {
      Usuario,
      Tienda,
      Servicio,
      Producto,
      ServicioTienda,
      Oferta,
      Codigo,
      Entrada,
      Salida,
      SalidaEntrada,
      Cuenta,
      Operacion,
      Venta,
      Cliente,          // ✅ AGREGAR ESTO
      ListaVenta,
      VentaEntrada,
      MovimientoLista,
      Movimiento,
      MovimientoEntrada,
      Deuda,
      PagoDeuda
    };

    Object.values(models).forEach((model) => {
      if (typeof model.associate === "function") {
        model.associate(models);
      }
    });

    await sequelize.sync({ alter: true });
    console.log("✅ Tablas sincronizadas correctamente");

    const licenseInfo = SecureLicenseManager.getLicenseInfo();
    if (licenseInfo) {
      const status = SecureLicenseManager.checkLicense();
      if (status.isValid) {
        console.log(`✅ Licencia válida - Días restantes: ${status.remainingDays}`);
        logger.info(`Licencia válida - Días restantes: ${status.remainingDays}`);
      } else {
        console.warn(`⚠️ ${status.message}`);
        logger.warn(`Licencia inválida: ${status.message}`);
      }
    } else {
      console.warn("⚠️ No se encontró archivo de licencia. La API funcionará pero las peticiones serán denegadas.");
      logger.warn("No se encontró archivo de licencia.");
    }

    const PORT = process.env.PORT || 4000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
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