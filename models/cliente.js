const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

const Cliente = sequelize.define(
  "cliente",
  {
    id_cliente: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: {
          args: [1, 150],
          msg: "El nombre debe tener entre 1 y 150 caracteres",
        },
      },
    },
    nota: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: {
          args: [0, 255],
          msg: "La nota no puede exceder 255 caracteres",
        },
      },
    },
    direccion: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: {
          args: [0, 255],
          msg: "La dirección no puede exceder 255 caracteres",
        },
      },
    },
    telefono: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true, // En Postgres los NULL no colisionan
      validate: {
        len: {
          args: [0, 30],
          msg: "El teléfono no puede exceder 30 caracteres",
        },
      },
    },
    localizacion_coordenadas_gps: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: {
          args: [0, 100],
          msg: "La localización GPS no puede exceder 100 caracteres",
        },
      },
    },
    tipo_cliente: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: {
          args: [0, 50],
          msg: "El tipo de cliente no puede exceder 50 caracteres",
        },
      },
    },
    descuento: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: {
          args: [0, 50],
          msg: "El descuento no puede exceder 50 caracteres",
        },
      },
    },
  },
  {
    timestamps: true,
    tableName: "clientes",
    indexes: [
      { fields: ["nombre"] },
      { fields: ["telefono"] },
    ],
  }
);

// Asociaciones
Cliente.associate = function (models) {
  Cliente.hasMany(models.ListaVenta, {
    foreignKey: "id_cliente",
    as: "listaVentas",
  });
  // ✅ NUEVA ASOCIACIÓN
  Cliente.hasMany(models.Deuda, {
    foreignKey: "id_cliente",
    as: "deudas",
  });
};

module.exports = { Cliente };