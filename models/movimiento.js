const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

const Movimiento = sequelize.define(
  "movimiento",
  {
    id_movimiento: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    cantidad: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      validate: {
        min: {
          args: [0.00001],
          msg: "La cantidad debe ser mayor que cero",
        },
      },
    },
    nota: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: {
          args: [0, 255],
          msg: "La nota no puede exceder 255 caracteres",
        },
      },
    },
    // FK hacia ServicioTienda (origen)
    id_servicio_tienda_origen: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "servicio_tiendas",
        key: "id_servicio_tienda",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT", // No permitir eliminar un servicio_tienda con movimientos como origen
    },
    // FK hacia ServicioTienda (destino)
    id_servicio_tienda_destino: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "servicio_tiendas",
        key: "id_servicio_tienda",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT", // No permitir eliminar un servicio_tienda con movimientos como destino
    },
    // FK hacia MovimientoLista (obligatoria)
    id_movimiento_lista: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "movimiento_listas",
        key: "id_movimiento_lista",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
  },
  {
    timestamps: true,
    tableName: "movimientos",
    indexes: [
      { fields: ["id_servicio_tienda_origen"] },
      { fields: ["id_servicio_tienda_destino"] },
      { fields: ["id_movimiento_lista"] },
    ],
  }
);

// Asociaciones
Movimiento.associate = function (models) {
  Movimiento.belongsTo(models.ServicioTienda, {
    foreignKey: "id_servicio_tienda_origen",
    as: "servicioTiendaOrigen",
  });
  Movimiento.belongsTo(models.ServicioTienda, {
    foreignKey: "id_servicio_tienda_destino",
    as: "servicioTiendaDestino",
  });
  Movimiento.belongsTo(models.MovimientoLista, {
    foreignKey: "id_movimiento_lista",
    as: "movimientoLista",
  });
  // Relación muchos a muchos con Entrada a través de MovimientoEntrada
  Movimiento.belongsToMany(models.Entrada, {
    through: models.MovimientoEntrada,
    foreignKey: "id_movimiento",
    otherKey: "id_entrada",
    as: "entradas",
  });
  // Relación directa con la tabla intermedia
  Movimiento.hasMany(models.MovimientoEntrada, {
    foreignKey: "id_movimiento",
    as: "movimientoEntradas",
  });
};

module.exports = { Movimiento };