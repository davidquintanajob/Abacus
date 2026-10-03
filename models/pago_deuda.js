const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");
const { tiposCuenta } = require("./cuenta");

const PagoDeuda = sequelize.define(
  "pago_deuda",
  {
    id_pago_deuda: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    fecha_hora: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    cantidad_pagada: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      validate: {
        min: {
          args: [0.00001],
          msg: "La cantidad pagada debe ser mayor que cero",
        },
      },
    },
    forma_pago: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: {
          args: [tiposCuenta],
          msg: `La forma de pago debe ser uno de: ${tiposCuenta.join(", ")}`,
        },
      },
    },
    cambio_moneda: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: {
          args: [0.00001],
          msg: "El cambio de moneda debe ser mayor que cero",
        },
      },
    },
    // FK hacia Deuda (obligatoria)
    id_deuda: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "deudas",
        key: "id_deuda",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    // ✅ NUEVA FK hacia Operacion (obligatoria y única: cada pago_deuda pertenece a una única operación)
    id_operacion: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: "operaciones",
        key: "id_operacion",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT", // No permitir eliminar una operación que tenga un pago_deuda
    },
  },
  {
    timestamps: true,
    tableName: "pagos_deuda",
    indexes: [
      { fields: ["id_deuda"] },
      { fields: ["id_operacion"] },
      { fields: ["fecha_hora"] },
    ],
  }
);

// Asociaciones
PagoDeuda.associate = function (models) {
  PagoDeuda.belongsTo(models.Deuda, {
    foreignKey: "id_deuda",
    as: "deuda",
  });
  // ✅ NUEVA ASOCIACIÓN
  PagoDeuda.belongsTo(models.Operacion, {
    foreignKey: "id_operacion",
    as: "operacion",
  });
};

module.exports = { PagoDeuda };