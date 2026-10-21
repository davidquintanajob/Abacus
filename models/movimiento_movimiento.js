const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

const MovimientoMovimiento = sequelize.define(
  "movimiento_movimiento",
  {
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
    id_movimiento_origen: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: "movimientos",
        key: "id_movimiento",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
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
    tableName: "movimientos_movimientos",
    indexes: [
      { fields: ["id_movimiento"] },
      { fields: ["id_movimiento_origen"] },
    ],
  }
);

MovimientoMovimiento.associate = function (models) {
  MovimientoMovimiento.belongsTo(models.Movimiento, {
    foreignKey: "id_movimiento",
    as: "movimiento",
  });
  MovimientoMovimiento.belongsTo(models.Movimiento, {
    foreignKey: "id_movimiento_origen",
    as: "movimientoOrigen",
  });
};

module.exports = { MovimientoMovimiento };