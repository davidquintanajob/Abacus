const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

const VentaEntrada = sequelize.define(
  "venta_entrada",
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
    id_entrada: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: "entradas",
        key: "id_entrada",
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
    tableName: "ventas_entradas",
    indexes: [
      { fields: ["id_venta"] },
      { fields: ["id_entrada"] },
    ],
  }
);

// Asociaciones
VentaEntrada.associate = function (models) {
  VentaEntrada.belongsTo(models.Venta, {
    foreignKey: "id_venta",
    as: "venta",
  });
  VentaEntrada.belongsTo(models.Entrada, {
    foreignKey: "id_entrada",
    as: "entrada",
  });
};

module.exports = { VentaEntrada };