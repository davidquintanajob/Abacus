const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

const Codigo = sequelize.define("codigo", {
  id_codigo: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  id_servicio: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "servicios",
      key: "id_servicio",
    },
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
  },
  codigo_barras_ean: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: {
        msg: "El código de barras EAN no puede estar vacío",
      },
      len: {
        args: [1, 100],
        msg: "El código de barras EAN debe tener entre 1 y 100 caracteres",
      },
    },
  },
  nota: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  timestamps: true,
  indexes: [
    { fields: ["codigo_barras_ean"] },
    { fields: ["id_servicio"] },
  ],
});

Codigo.associate = function(models) {
  Codigo.belongsTo(models.Servicio, {
    foreignKey: "id_servicio",
    as: "servicio",
  });
};

module.exports = { Codigo };
