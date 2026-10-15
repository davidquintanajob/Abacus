const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

const tiposNotificacion = ["Información", "Éxito", "Advertencia", "Error"];

const Notificacion = sequelize.define(
  "notificacion",
  {
    id_notificacion: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    id_usuario: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id_usuario",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    titulo: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    mensaje: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    fecha_hora: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    id_relacion: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    tipo: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: {
          args: [tiposNotificacion],
          msg: `El tipo de notificación debe ser uno de: ${tiposNotificacion.join(", ")}`,
        },
      },
    },
  },
  {
    timestamps: true,
    tableName: "notificaciones",
    indexes: [
      { fields: ["id_usuario"] },
      { fields: ["fecha_hora"] },
      { fields: ["is_read"] },
      { fields: ["tipo"] },
    ],
  }
);

Notificacion.associate = function (models) {
  Notificacion.belongsTo(models.Usuario, {
    foreignKey: "id_usuario",
    as: "usuario",
  });
};

module.exports = { Notificacion, tiposNotificacion };
