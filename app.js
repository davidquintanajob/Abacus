/* global process */
const express = require("express");
const cors = require("cors");
const logger = require("./helpers/logger.js");
const sequelize = require("./helpers/database.js");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
require("dotenv").config();
const path = require("path");
const fs = require("fs");

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
  // Opcional: puedes registrar el estado en cada request (solo para depuración)
  // logger.debug(`Licencia válida - Días restantes: ${status.remainingDays}`);
  next();
});

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
const listaVentaRoutes = require("./routes/listaVentaRoutes.js");

app.use("/", servicioRoutes);
app.use("/", productoRoutes);
app.use("/", usuarioRoutes);
app.use("/", tiendaRoutes);
app.use("/config", configRoutes);
app.use("/", entradaRoutes);
app.use("/", salidaRoutes);
app.use("/", cuentaRoutes);
app.use("/", operacionRoutes);
app.use("/", listaVentaRoutes);

// Inicializar la base de datos y arrancar el servidor
const startApp = async () => {
  try {
    // Crear carpetas necesarias (local_config, fotos)
    const monedaDir = path.join(__dirname, "local_config");
    if (!fs.existsSync(monedaDir)) fs.mkdirSync(monedaDir, { recursive: true });
    const fotosDir = path.join(__dirname, "fotos");
    if (!fs.existsSync(fotosDir)) fs.mkdirSync(fotosDir, { recursive: true });
    // Subcarpetas (opcional)
    ["servicio_complejo", "paciente", "consulta"].forEach((sub) => {
      const subDir = path.join(fotosDir, sub);
      if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
    });

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
    const { ListaVenta } = require("./models/lista_venta");
    const { VentaEntrada } = require("./models/venta_entrada");

    // Agrupar todos los modelos en un objeto para pasarlos a las asociaciones
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
      ListaVenta,
      VentaEntrada
    };

    // Ejecutar el método associate de cada modelo si existe
    Object.values(models).forEach((model) => {
      if (typeof model.associate === "function") {
        model.associate(models);
      }
    });

    // Sincronizar todas las tablas (con alter: true para actualizar sin perder datos)
    await sequelize.sync({ alter: true });
    console.log("✅ Tablas sincronizadas correctamente");

    // <-- NUEVO: Verificar el estado de la licencia al iniciar y mostrar notificación
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

// Cierre limpio
process.on("SIGINT", async () => {
  await sequelize.close();
  process.exit(0);
});

startApp();

module.exports = app;