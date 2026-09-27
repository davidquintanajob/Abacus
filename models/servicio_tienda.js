const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

const ServicioTienda = sequelize.define("servicio_tienda", {
  id_servicio_tienda: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  id_tienda: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "tiendas",
      key: "id_tienda",
    },
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
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
  precio_cup: {
    type: DataTypes.DECIMAL(14, 5),
    allowNull: false,
    defaultValue: 0.00000,
  },
  precio_usd: {
    type: DataTypes.DECIMAL(14, 5),
    allowNull: false,
    defaultValue: 0.00000,
  },
  costo_cup: {
    type: DataTypes.DECIMAL(14, 5),
    allowNull: false,
    defaultValue: 0.00000,
  },
  costo_usd: {
    type: DataTypes.DECIMAL(14, 5),
    allowNull: false,
    defaultValue: 0.00000,
  },
  cantidad: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  cantidad_alerta: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'servicio_tiendas',
  indexes: [
    { fields: ["id_tienda"] },
    { fields: ["id_servicio"] },
  ],
});

ServicioTienda.associate = function(models) {
  ServicioTienda.belongsTo(models.Tienda, {
    foreignKey: "id_tienda",
    as: "tienda",
  });
  ServicioTienda.belongsTo(models.Servicio, {
    foreignKey: "id_servicio",
    as: "servicio",
  });
  ServicioTienda.hasMany(models.Entrada, {
    foreignKey: "id_servicio_tienda",
    as: "entradas",
  });
  ServicioTienda.hasMany(models.Salida, {
    foreignKey: "id_servicio_tienda",
    as: "salidas",
  });
  // ✅ NUEVA RELACIÓN
  ServicioTienda.hasMany(models.Venta, {
    foreignKey: "id_servicio_tienda",
    as: "ventas",
  });
  ServicioTienda.hasMany(models.Movimiento, {
    foreignKey: "id_servicio_tienda_origen",
    as: "movimientos_origen",
  });
  ServicioTienda.hasMany(models.Movimiento, {
    foreignKey: "id_servicio_tienda_destino",
    as: "movimientos_destino",
  });
};

module.exports = { ServicioTienda };