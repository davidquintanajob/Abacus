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
    id_usuario: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id_usuario",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    cambio_moneda: {
      type: DataTypes.DECIMAL(14, 5),
      allowNull: false,
      defaultValue: 1.00000,
      validate: {
        min: {
          args: [0.00001],
          msg: "El cambio de moneda debe ser mayor que cero",
        },
      },
    },
    cantidad_cobrada_efectivo_cup: {
      type: DataTypes.DECIMAL(14, 5),
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
      type: DataTypes.DECIMAL(14, 5),
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
      type: DataTypes.DECIMAL(14, 5),
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
      type: DataTypes.DECIMAL(14, 5),
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
  // ✅ NUEVA ASOCIACIÓN
  ListaVenta.belongsTo(models.Cliente, {
    foreignKey: "id_cliente",
    as: "cliente",
  });
  ListaVenta.belongsTo(models.Usuario, {
    foreignKey: "id_usuario",
    as: "usuario",
  });
};

module.exports = { ListaVenta };