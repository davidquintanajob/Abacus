const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

const MovimientoLista = sequelize.define(
  "movimiento_lista",
  {
    id_movimiento_lista: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    fecha_hora: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    tipo_movimiento: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: {
          args: [1, 50],
          msg: "El tipo de movimiento debe tener entre 1 y 50 caracteres",
        },
      },
    },
    estado: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    // FK hacia Usuario (obligatoria)
    id_usuario: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id_usuario",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT", // No permitir eliminar un usuario con movimientos
    },
  },
  {
    timestamps: true,
    tableName: "movimiento_listas",
    indexes: [
      { fields: ["id_usuario"] },
      { fields: ["fecha_hora"] },
      { fields: ["tipo_movimiento"] },
    ],
  }
);

// Asociaciones
MovimientoLista.associate = function (models) {
  MovimientoLista.belongsTo(models.Usuario, {
    foreignKey: "id_usuario",
    as: "usuario",
  });
  MovimientoLista.hasMany(models.Movimiento, {
    foreignKey: "id_movimiento_lista",
    as: "movimientos",
  });
};

module.exports = { MovimientoLista };