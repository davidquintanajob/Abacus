const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

const Tienda = sequelize.define("tienda", {
  id_tienda: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      len: {
        args: [3, 100],
        msg: "El nombre debe tener entre 3 y 100 caracteres",
      },
    },
  },
  tipo: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: {
        args: [2, 50],
        msg: "El tipo debe tener entre 2 y 50 caracteres",
      },
    },
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  timestamps: true,
  indexes: [
    { fields: ["nombre"] },
    { fields: ["tipo"] },
  ],
});

// Definición de asociación (estilo Entrada/Producto)
Tienda.associate = function(models) {
  Tienda.hasMany(models.Usuario, { foreignKey: 'id_tienda', as: 'usuarios' });
  // NUEVA: Relación directa con ServicioTienda
  Tienda.hasMany(models.ServicioTienda, {
    foreignKey: "id_tienda",
    as: "tiendas_servicio",
  });
};

module.exports = { Tienda };