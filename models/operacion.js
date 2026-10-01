const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

// Tipos de operación permitidos
const tiposOperacion = ["Ingreso", "Retiro", "Ingreso por Venta"];

const Operacion = sequelize.define(
  "operacion",
  {
    id_operacion: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    // Clave foránea hacia Cuenta (obligatoria)
    id_cuenta: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "cuentas",
        key: "id_cuenta",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    // Clave foránea hacia Usuario (opcional)
    id_usuario: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id_usuario",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    // ✅ NUEVA CLAVE FORÁNEA hacia ListaVenta (opcional)
    id_lista_venta: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "lista_ventas",
        key: "id_lista_venta",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    cantidad_operacion: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0.00000,
      validate: {
        min: {
          args: [0],
          msg: "La cantidad no puede ser negativa",
        },
      },
    },
    tipo_operacion: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: {
          args: [tiposOperacion],
          msg: `El tipo de operación debe ser uno de: ${tiposOperacion.join(", ")}`,
        },
      },
    },
    fecha_hora: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    motivo: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: {
          args: [1, 255],
          msg: "El motivo debe tener entre 1 y 255 caracteres",
        },
      },
    },
    cambio_moneda: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 1.00000,
      validate: {
        min: {
          args: [0.00001],
          msg: "El cambio de moneda debe ser mayor que cero",
        },
      },
    },
  },
  {
    timestamps: true,
    tableName: "operaciones",
    indexes: [
      { fields: ["id_cuenta"] },
      { fields: ["id_usuario"] },
      { fields: ["id_lista_venta"] }, // ✅ NUEVO ÍNDICE
      { fields: ["fecha_hora"] },
      { fields: ["tipo_operacion"] },
    ],
  }
);

// Asociaciones
Operacion.associate = function (models) {
  Operacion.belongsTo(models.Cuenta, {
    foreignKey: "id_cuenta",
    as: "cuenta",
  });
  Operacion.belongsTo(models.Usuario, {
    foreignKey: "id_usuario",
    as: "usuario",
  });
  // ✅ NUEVA ASOCIACIÓN
  Operacion.belongsTo(models.ListaVenta, {
    foreignKey: "id_lista_venta",
    as: "listaVenta",
  });
};

module.exports = { Operacion, tiposOperacion };