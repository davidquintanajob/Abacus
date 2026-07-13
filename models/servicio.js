const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

const Servicio = sequelize.define("servicio", {
  id_servicio: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: {
        args: [3, 100],
        msg: "El nombre debe tener entre 3 y 100 caracteres",
      },
    },
  },
  esvendible: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  categoria: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: {
        args: [2, 50],
        msg: "La categoría debe tener entre 2 y 50 caracteres",
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
    { fields: ["nombre"] },
    { fields: ["categoria"] },
  ],
});

// ========== ASOCIACIONES ==========
Servicio.associate = function(models) {
  Servicio.belongsToMany(models.Tienda, {
    through: models.ServicioTienda,
    foreignKey: "id_servicio",
    otherKey: "id_tienda",
    as: "tiendas",
  });

  Servicio.hasOne(models.Producto, {
    foreignKey: "id_servicio",
    as: "producto",
  });

  Servicio.hasMany(models.Codigo, {
    foreignKey: "id_servicio",
    as: "codigos",
  });

  Servicio.belongsToMany(models.Servicio, {
    through: models.Oferta,
    foreignKey: "id_servicio_oferta",
    otherKey: "id_servicio_componente",
    as: "componentes",
  });
  Servicio.belongsToMany(models.Servicio, {
    through: models.Oferta,
    foreignKey: "id_servicio_componente",
    otherKey: "id_servicio_oferta",
    as: "ofertas_que_incluyen",
  });

  Servicio.hasMany(models.ServicioTienda, {
    foreignKey: "id_servicio",
    as: "tiendas_servicio",
  });
};

module.exports = { Servicio };