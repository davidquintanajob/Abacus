const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

const Deuda = sequelize.define(
  "deuda",
  {
    id_deuda: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    fecha_hora: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    monto_cup: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: "El monto en CUP no puede ser negativo",
        },
      },
    },
    monto_usd: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: "El monto en USD no puede ser negativo",
        },
      },
    },
    monto_restante_cup: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: "El monto restante en CUP no puede ser negativo",
        },
      },
    },
    monto_restante_usd: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: "El monto restante en USD no puede ser negativo",
        },
      },
    },
    cambio_moneda: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: {
          args: [0.00001],
          msg: "El cambio de moneda debe ser mayor que cero",
        },
      },
    },
    // FK hacia Cliente (obligatoria)
    id_cliente: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "clientes",
        key: "id_cliente",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT", // No permitir eliminar un cliente con deudas
    },
    // FK hacia ListaVenta (opcional)
    id_lista_venta: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "lista_ventas",
        key: "id_lista_venta",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL", // Si se elimina la lista_venta, la deuda queda sin lista asociada
    },
  },
  {
    timestamps: true,
    tableName: "deudas",
    indexes: [
      { fields: ["id_cliente"] },
      { fields: ["id_lista_venta"] },
      { fields: ["fecha_hora"] },
    ],
  }
);

// Asociaciones
Deuda.associate = function (models) {
  Deuda.belongsTo(models.Cliente, {
    foreignKey: "id_cliente",
    as: "cliente",
  });
  Deuda.belongsTo(models.ListaVenta, {
    foreignKey: "id_lista_venta",
    as: "listaVenta",
  });
  Deuda.hasMany(models.PagoDeuda, {
    foreignKey: "id_deuda",
    as: "pagos",
  });
};

module.exports = { Deuda };