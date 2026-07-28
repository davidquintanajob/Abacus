const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

const SalidaEntrada = sequelize.define(
  "salida_entrada",
  {
    id_salida: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: "salidas",
        key: "id_salida",
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
    timestamps: false, // No necesitamos createdAt/updatedAt en la intermedia
    tableName: "salidas_entradas",
    indexes: [
      { fields: ["id_salida"] },
      { fields: ["id_entrada"] },
    ],
  }
);

// Asociaciones
SalidaEntrada.associate = function (models) {
  SalidaEntrada.belongsTo(models.Salida, {
    foreignKey: "id_salida",
    as: "salida",
  });
  SalidaEntrada.belongsTo(models.Entrada, {
    foreignKey: "id_entrada",
    as: "entrada",
  });
};

module.exports = { SalidaEntrada };