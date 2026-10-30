const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

const Fabricacion = sequelize.define(
  "fabricacion",
  {
    id_fabricacion: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    id_entrada: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "entradas",
        key: "id_entrada",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    id_servicio_tienda: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "servicio_tiendas",
        key: "id_servicio_tienda",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    cantidad_insumo: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      validate: {
        min: {
          args: [0],
          msg: "La cantidad de insumo no puede ser negativa",
        },
      },
    },
    costo_insumo_cup: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0.00000,
    },
    costo_insumo_usd: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0.00000,
    },
  },
  {
    timestamps: false,
    tableName: "fabricacion",
    indexes: [
      { fields: ["id_entrada"] },
      { fields: ["id_servicio_tienda"] },
    ],
  }
);

Fabricacion.associate = function (models) {
  Fabricacion.belongsTo(models.Entrada, {
    foreignKey: "id_entrada",
    as: "entrada",
  });
  Fabricacion.belongsTo(models.ServicioTienda, {
    foreignKey: "id_servicio_tienda",
    as: "servicioTienda",
  });
  Fabricacion.hasMany(models.FabricacionEntrada, {
    foreignKey: "id_fabricacion",
    as: "entradasInsumo",
  });
  Fabricacion.hasMany(models.FabricacionMovimiento, {
    foreignKey: "id_fabricacion",
    as: "movimientosInsumo",
  });
};

module.exports = { Fabricacion };
