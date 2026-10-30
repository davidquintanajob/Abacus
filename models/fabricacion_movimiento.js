const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

const FabricacionMovimiento = sequelize.define(
  "fabricacion_movimiento",
  {
    id_fabricacion: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: "fabricacion",
        key: "id_fabricacion",
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
    tableName: "fabricacion_movimientos",
    indexes: [
      { fields: ["id_fabricacion"] },
      { fields: ["id_movimiento"] },
    ],
  }
);

FabricacionMovimiento.associate = function (models) {
  FabricacionMovimiento.belongsTo(models.Fabricacion, {
    foreignKey: "id_fabricacion",
    as: "fabricacion",
  });
  FabricacionMovimiento.belongsTo(models.Movimiento, {
    foreignKey: "id_movimiento",
    as: "movimiento",
  });
};

module.exports = { FabricacionMovimiento };
