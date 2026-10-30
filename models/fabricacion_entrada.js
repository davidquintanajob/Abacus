const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

const FabricacionEntrada = sequelize.define(
  "fabricacion_entrada",
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
    id_entrada: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: "entradas",
        key: "id_entrada",
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
    tableName: "fabricacion_entradas",
    indexes: [
      { fields: ["id_fabricacion"] },
      { fields: ["id_entrada"] },
    ],
  }
);

FabricacionEntrada.associate = function (models) {
  FabricacionEntrada.belongsTo(models.Fabricacion, {
    foreignKey: "id_fabricacion",
    as: "fabricacion",
  });
  FabricacionEntrada.belongsTo(models.Entrada, {
    foreignKey: "id_entrada",
    as: "entrada",
  });
};

module.exports = { FabricacionEntrada };
