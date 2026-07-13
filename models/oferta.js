const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

const Oferta = sequelize.define("oferta", {
  // Clave primaria compuesta (sin id propio)
  id_servicio_oferta: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    references: {
      model: "servicios",   // nombre de la tabla en BD (plural)
      key: "id_servicio",
    },
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
  },
  id_servicio_componente: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    references: {
      model: "servicios",
      key: "id_servicio",
    },
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
  },
  cantidad: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 1.0,
    validate: {
      min: {
        args: [0],
        msg: "La cantidad no puede ser negativa",
      },
    },
  },
}, {
  timestamps: false,   // según el modelo de referencia
  indexes: [
    { fields: ["id_servicio_oferta"] },
    { fields: ["id_servicio_componente"] },
  ],
});

// ========== ASOCIACIONES ==========
Oferta.associate = function(models) {
  Oferta.belongsTo(models.Servicio, {
    foreignKey: "id_servicio_oferta",
    as: "servicio_oferta",
  });
  Oferta.belongsTo(models.Servicio, {
    foreignKey: "id_servicio_componente",
    as: "servicio_componente",
  });
};

module.exports = { Oferta };