const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

const Producto = sequelize.define("producto", {
  // Clave primaria y foránea a servicio
  id_servicio: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
    references: {
      model: "servicios",         // nombre de la tabla en BD (plural)
      key: "id_servicio",
    },
    onUpdate: "CASCADE",
    onDelete: "CASCADE",          // si se elimina el servicio, también el producto
    // Si prefieres RESTRICT para evitar borrados accidentales, cambia a "RESTRICT"
  },
  imagen: {
    type: DataTypes.STRING,
    allowNull: true
  },
  sufijo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      len: {
        args: [1, 50],
        msg: "El sufijo debe tener entre 1 y 50 caracteres",
      },
    },
  },
  isVencible: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  unidad_medida: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [1, 20],
        msg: "La unidad de medida debe tener entre 1 y 20 caracteres",
      },
    },
  },
}, {
  timestamps: true,
  indexes: [
    { fields: ["sufijo"] },
  ],
});

// Asociaciones
Producto.associate = function(models) {
  Producto.belongsTo(models.Servicio, {
    foreignKey: "id_servicio",
    as: "servicio",
  });
};

module.exports = { Producto };