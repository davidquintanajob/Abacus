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
    id_tienda_origen: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tiendas",
        key: "id_tienda",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    id_tienda_destino: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tiendas",
        key: "id_tienda",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    id_servicio: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "servicios",
        key: "id_servicio",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
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
      { fields: ["id_tienda_origen"] },
      { fields: ["id_tienda_destino"] },
      { fields: ["id_servicio"] },
      { fields: ["id_movimiento_lista"] },
    ],
  }
);

// Asociaciones
Movimiento.associate = function (models) {
  Movimiento.belongsTo(models.Tienda, {
    foreignKey: "id_tienda_origen",
    as: "tiendaOrigen",
  });
  Movimiento.belongsTo(models.Tienda, {
    foreignKey: "id_tienda_destino",
    as: "tiendaDestino",
  });
  Movimiento.belongsTo(models.Servicio, {
    foreignKey: "id_servicio",
    as: "servicio",
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