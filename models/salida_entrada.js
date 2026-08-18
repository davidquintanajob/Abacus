const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

const SalidaEntrada = sequelize.define(
  "salida_entrada",
  {
    id_salida: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,          // Clave primaria compuesta (parte 1)
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
      primaryKey: true,          // Clave primaria compuesta (parte 2)
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
    tableName: "salidas_entradas",
    // 🔽 Eliminamos índices únicos automáticos y aseguramos la clave primaria compuesta
    indexes: [
      // Índice para búsquedas por id_salida (no único)
      { fields: ["id_salida"] },
      // Índice para búsquedas por id_entrada (no único)
      { fields: ["id_entrada"] },
      // Opcional: índice compuesto para mejorar consultas con ambos campos
      // { fields: ["id_salida", "id_entrada"] }
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