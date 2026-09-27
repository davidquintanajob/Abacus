const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

// Tipos de cuenta permitidos
const tiposCuenta = ["Efectivo CUP", "Transferencia CUP", "Efectivo USD", "Transferencia USD"];

const Cuenta = sequelize.define(
  "cuenta",
  {
    id_cuenta: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: {
          args: [1, 100],
          msg: "El nombre debe tener entre 1 y 100 caracteres",
        },
      },
    },
    tipo_cuenta: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: {
          args: [tiposCuenta],
          msg: `El tipo de cuenta debe ser uno de: ${tiposCuenta.join(", ")}`,
        },
      },
    },
    num_cuenta: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: {
          args: [12, 16],
          msg: "El número de cuenta debe tener entre 12 y 16 caracteres",
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
    // NUEVO CAMPO: fondo (solo modificable externamente)
    fondo: {
      type: DataTypes.DECIMAL(14, 5),
      allowNull: false,
      defaultValue: 0.00000,
      validate: {
        min: {
          args: [0],
          msg: "El fondo no puede ser negativo",
        },
      },
    },
  },
  {
    timestamps: true,
    tableName: "cuentas",
    indexes: [
      { fields: ["nombre"] },
      { fields: ["tipo_cuenta"] },
    ],
  }
);

// Asociaciones
Cuenta.associate = function (models) {
  Cuenta.hasMany(models.Operacion, {
    foreignKey: "id_cuenta",
    as: "operaciones",
  });
};

module.exports = { Cuenta, tiposCuenta };