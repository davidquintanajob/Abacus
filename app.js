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

const app = express();

// Middlewares básicos
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cors({
  origin: process.env.CORS_OPTIONS || "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Servir archivos estáticos (fotos si se usan)
app.use("/fotos", express.static(path.join(__dirname, "fotos")));

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
      schemas: {
        Usuario: {
          type: "object",
          properties: {
            id_usuario: { type: "integer" },
            nombre_natural: { type: "string" },
            telefono: { type: "string" },
            direccion: { type: "string" },
            nombre_usuario: { type: "string" },
            salario_diario: { type: "number" },
            rol: { type: "string" },
            activo: { type: "boolean" },
            id_tienda: { type: "integer" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Tienda: {
          type: "object",
          properties: {
            id_tienda: { type: "integer" },
            nombre: { type: "string" },
            tipo: { type: "string" },
            activo: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
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
const usuarioRoutes = require("./routes/usuarioRoutes");
const tiendaRoutes = require("./routes/tiendaRoutes");
app.use("/", usuarioRoutes);
app.use("/", tiendaRoutes);

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

    // Definir asociaciones (si los modelos tienen método associate)
    if (Usuario.associate) Usuario.associate({ Tienda });
    if (Tienda.associate) Tienda.associate({ Usuario });

    // Sincronizar todas las tablas (con alter: true para actualizar sin perder datos)
    await sequelize.sync({ alter: true });
    console.log("✅ Tablas sincronizadas correctamente");

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