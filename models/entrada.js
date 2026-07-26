const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

const Entrada = sequelize.define(
  "entrada",
  {
    id_entrada: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    // Clave foránea hacia Usuario
    id_usuario: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id_usuario",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT", // No permitir eliminar un usuario que tenga entradas
    },
    // Clave foránea hacia ServicioTienda
    id_servicio_tienda: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "servicio_tiendas", // nombre de la tabla en BD
        key: "id_servicio_tienda",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT", // No permitir eliminar un servicio_tienda que tenga entradas
    },
    codigo_lote: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        len: {
          args: [1, 100],
          msg: "El código de lote debe tener entre 1 y 100 caracteres",
        },
      },
    },
    cantidad_entrada: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      validate: {
        min: {
          args: [0],
          msg: "La cantidad de entrada no puede ser negativa",
        },
      },
    },
    cantidad_restante: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      validate: {
        min: {
          args: [0],
          msg: "La cantidad restante no puede ser negativa",
        },
      },
    },
    costo_usd: {
      type: DataTypes.DECIMAL(10, 5),
      allowNull: false,
      defaultValue: 0.00000,
    },
    costo_cup: {
      type: DataTypes.DECIMAL(10, 5),
      allowNull: false,
      defaultValue: 0.00000,
    },
    fecha: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    fecha_vencimiento: {
      type: DataTypes.DATEONLY, // Solo fecha sin hora
      allowNull: true,
    },
    nombre_proveedor: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: {
          args: [0, 200],
          msg: "El nombre del proveedor no puede exceder 200 caracteres",
        },
      },
    },
  },
  {
    timestamps: true, // createdAt y updatedAt
    tableName: "entradas", // nombre explícito de la tabla
    indexes: [
      { fields: ["id_usuario"] },
      { fields: ["id_servicio_tienda"] },
      { fields: ["codigo_lote"] },
      { fields: ["fecha"] },
    ],
  }
);

// Asociaciones
Entrada.associate = function (models) {
  Entrada.belongsTo(models.Usuario, {
    foreignKey: "id_usuario",
    as: "usuario",
  });
  Entrada.belongsTo(models.ServicioTienda, {
    foreignKey: "id_servicio_tienda",
    as: "servicioTienda",
  });
};

module.exports = { Entrada };