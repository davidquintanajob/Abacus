const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

const Venta = sequelize.define(
  "venta",
  {
    id_venta: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    // Clave foránea hacia ServicioTienda
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
    // Clave foránea hacia ListaVenta
    id_lista_venta: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "lista_ventas",
        key: "id_lista_venta",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
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
    precio_original_cup: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0.00000,
      validate: {
        min: {
          args: [0],
          msg: "El precio original en CUP no puede ser negativo",
        },
      },
    },
    precio_original_usd: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0.00000,
      validate: {
        min: {
          args: [0],
          msg: "El precio original en USD no puede ser negativo",
        },
      },
    },
    costo_original_cup: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0.00000,
      validate: {
        min: {
          args: [0],
          msg: "El costo original en CUP no puede ser negativo",
        },
      },
    },
    costo_original_usd: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0.00000,
      validate: {
        min: {
          args: [0],
          msg: "El costo original en USD no puede ser negativo",
        },
      },
    },
    precio_cobrado_usd: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0.00000,
      validate: {
        min: {
          args: [0],
          msg: "El precio cobrado en USD no puede ser negativo",
        },
      },
    },
    precio_cobrado_cup: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0.00000,
      validate: {
        min: {
          args: [0],
          msg: "El precio cobrado en CUP no puede ser negativo",
        },
      },
    },
  },
  {
    timestamps: true,
    tableName: "ventas",
    indexes: [
      { fields: ["id_servicio_tienda"] },
      { fields: ["id_lista_venta"] },
    ],
  }
);

// Asociaciones
Venta.associate = function (models) {
  Venta.belongsTo(models.ServicioTienda, {
    foreignKey: "id_servicio_tienda",
    as: "servicioTienda",
  });
  Venta.belongsTo(models.ListaVenta, {
    foreignKey: "id_lista_venta",
    as: "listaVenta",
  });
  // Relación muchos a muchos con Entrada a través de VentaEntrada
  Venta.belongsToMany(models.Entrada, {
    through: models.VentaEntrada,
    foreignKey: "id_venta",
    otherKey: "id_entrada",
    as: "entradas",
  });
  // Relación directa con la tabla intermedia
  Venta.hasMany(models.VentaEntrada, {
    foreignKey: "id_venta",
    as: "ventaEntradas",
  });
};

module.exports = { Venta };