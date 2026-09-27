const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

const Salida = sequelize.define(
  "salida",
  {
    id_salida: {
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
      onDelete: "RESTRICT", // No permitir eliminar un usuario con salidas
    },
    // Clave foránea hacia ServicioTienda
    id_servicio_tienda: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "servicio_tiendas",
        key: "id_servicio_tienda",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT", // No permitir eliminar un servicio_tienda con salidas
    },
    fecha: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    descripcion: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: {
          args: [1, 255],
          msg: "La descripción debe tener entre 1 y 255 caracteres",
        },
      },
    },
    tipo_salida: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: {
          args: [1, 50],
          msg: "El tipo de salida debe tener entre 1 y 50 caracteres",
        },
      },
    },
    cantidad_total: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      validate: {
        min: {
          args: [0],
          msg: "La cantidad total no puede ser negativa",
        },
      },
    },
    costo_cup: {
      type: DataTypes.DECIMAL(14, 5),
      allowNull: false,
      defaultValue: 0.00000,
    },
    costo_usd: {
      type: DataTypes.DECIMAL(14, 5),
      allowNull: false,
      defaultValue: 0.00000,
    },
  },
  {
    timestamps: true,
    tableName: "salidas",
    indexes: [
      { fields: ["id_usuario"] },
      { fields: ["id_servicio_tienda"] },
      { fields: ["fecha"] },
    ],
  }
);

// Asociaciones
Salida.associate = function (models) {
  Salida.belongsTo(models.Usuario, {
    foreignKey: "id_usuario",
    as: "usuario",
  });
  Salida.belongsTo(models.ServicioTienda, {
    foreignKey: "id_servicio_tienda",
    as: "servicioTienda",
  });
  // Relación muchos a muchos con Entrada a través de SalidaEntrada
  Salida.belongsToMany(models.Entrada, {
    through: models.SalidaEntrada,
    foreignKey: "id_salida",
    otherKey: "id_entrada",
    as: "entradas",
  });
  // ✅ RELACIÓN DIRECTA CON LA TABLA INTERMEDIA (para poder incluirla)
  Salida.hasMany(models.SalidaEntrada, {
    foreignKey: "id_salida",
    as: "salidaEntradas",
  });
};

module.exports = { Salida };