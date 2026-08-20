const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

const ListaVenta = sequelize.define(
  "lista_venta",
  {
    id_lista_venta: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    fecha_hora: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
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
    cantidad_cobrada_efectivo_cup: {
      type: DataTypes.DECIMAL(10, 5),
      allowNull: false,
      defaultValue: 0.00000,
      validate: {
        min: {
          args: [0],
          msg: "La cantidad cobrada en efectivo (CUP) no puede ser negativa",
        },
      },
    },
    cantidad_cobrada_efectivo_usd: {
      type: DataTypes.DECIMAL(10, 5),
      allowNull: false,
      defaultValue: 0.00000,
      validate: {
        min: {
          args: [0],
          msg: "La cantidad cobrada en efectivo (USD) no puede ser negativa",
        },
      },
    },
    cantidad_cobrada_transferencia_cup: {
      type: DataTypes.DECIMAL(10, 5),
      allowNull: false,
      defaultValue: 0.00000,
      validate: {
        min: {
          args: [0],
          msg: "La cantidad cobrada por transferencia (CUP) no puede ser negativa",
        },
      },
    },
    cantidad_cobrada_transferencia_usd: {
      type: DataTypes.DECIMAL(10, 5),
      allowNull: false,
      defaultValue: 0.00000,
      validate: {
        min: {
          args: [0],
          msg: "La cantidad cobrada por transferencia (USD) no puede ser negativa",
        },
      },
    },
  },
  {
    timestamps: true,
    tableName: "lista_ventas",
    indexes: [
      { fields: ["fecha_hora"] },
    ],
  }
);

// Asociaciones
ListaVenta.associate = function (models) {
  ListaVenta.hasMany(models.Venta, {
    foreignKey: "id_lista_venta",
    as: "ventas",
  });
  ListaVenta.hasMany(models.Operacion, {
    foreignKey: "id_lista_venta",
    as: "operaciones",
  });
};

module.exports = { ListaVenta };