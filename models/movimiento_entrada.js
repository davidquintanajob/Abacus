const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

const MovimientoEntrada = sequelize.define(
  "movimiento_entrada",
  {
    id_movimiento: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true, // Clave primaria compuesta (parte 1)
      references: {
        model: "movimientos",
        key: "id_movimiento",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    id_entrada: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true, // Clave primaria compuesta (parte 2)
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
    tableName: "movimientos_entradas",
    indexes: [
      { fields: ["id_movimiento"] },
      { fields: ["id_entrada"] },
    ],
  }
);

// Asociaciones
MovimientoEntrada.associate = function (models) {
  MovimientoEntrada.belongsTo(models.Movimiento, {
    foreignKey: "id_movimiento",
    as: "movimiento",
  });
  MovimientoEntrada.belongsTo(models.Entrada, {
    foreignKey: "id_entrada",
    as: "entrada",
  });
};

module.exports = { MovimientoEntrada };