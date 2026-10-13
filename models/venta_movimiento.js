const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

const VentaMovimiento = sequelize.define(
  "venta_movimiento",
  {
    id_venta: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: "ventas",
        key: "id_venta",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    id_movimiento: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: "movimientos",
        key: "id_movimiento",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    cantidad: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      validate: {
        min: {
          args: [0],
          msg: "La cantidad no puede ser negativa",
        },
      },
    },
  },
  {
    timestamps: false,
    tableName: "ventas_movimientos",
    indexes: [
      { fields: ["id_venta"] },
      { fields: ["id_movimiento"] },
    ],
  }
);

VentaMovimiento.associate = function (models) {
  VentaMovimiento.belongsTo(models.Venta, {
    foreignKey: "id_venta",
    as: "venta",
  });
  VentaMovimiento.belongsTo(models.Movimiento, {
    foreignKey: "id_movimiento",
    as: "movimiento",
  });
};

module.exports = { VentaMovimiento };
