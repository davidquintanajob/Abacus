const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

const roles = ["Administrador", "Dependiente", "Almacenero", "Económico"];

const Usuario = sequelize.define("usuario", {
  id_usuario: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  nombre_natural: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  telefono: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  direccion: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  nombre_usuario: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  contrasenna: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  salario_diario: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    defaultValue: 0.00,
  },
  rol: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: {
        args: [roles],
        msg: "El rol especificado no es válido",
      },
    },
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  // → Nueva columna para la relación con Tienda
  id_tienda: {
    type: DataTypes.INTEGER,
    allowNull: true,                   // Puede ser null si no se asigna a ninguna tienda
    references: {
      model: 'tiendas',                // Nombre de la tabla en BD (plural)
      key: 'id_tienda'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',              // Si se elimina la tienda, los usuarios quedan sin tienda
  }
}, {
  timestamps: true,
});

// Definición de asociación (estilo Entrada/Producto)
Usuario.associate = function(models) {
  Usuario.belongsTo(models.Tienda, { foreignKey: 'id_tienda', as: 'tienda' });
  // Nueva relación: un usuario tiene muchas entradas
  Usuario.hasMany(models.Entrada, {
    foreignKey: 'id_usuario',
    as: 'entradas',
  });
  Usuario.hasMany(models.Salida, {
    foreignKey: 'id_usuario',
    as: 'salidas',
  });
};

module.exports = { Usuario, roles };