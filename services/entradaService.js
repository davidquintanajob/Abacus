const { Entrada } = require("../models/entrada");
const { ServicioTienda } = require("../models/servicio_tienda");
const { Servicio } = require("../models/servicio");
const { Producto } = require("../models/producto");
const { Usuario } = require("../models/usuario");
const { Tienda } = require("../models/tienda");
const { Op, Sequelize } = require("sequelize");
const { throwError } = require("../helpers/errorLauncher");

// Generar código de lote único: sufijo + 5 dígitos aleatorios
const generateCodigoLote = async (sufijo) => {
  let codigo;
  let exists = true;
  let attempts = 0;
  const maxAttempts = 100;
  while (exists && attempts < maxAttempts) {
    const random = Math.floor(10000 + Math.random() * 90000); // 5 dígitos
    codigo = `${sufijo}-${random}`;
    const count = await Entrada.count({ where: { codigo_lote: codigo } });
    exists = count > 0;
    attempts++;
  }
  if (exists) {
    throwError("No se pudo generar un código de lote único, intente de nuevo", 500);
  }
  return codigo;
};

// Validar que el servicio_tienda corresponda a un producto y obtener su isVencible
const validateServicioTiendaProducto = async (id_servicio_tienda) => {
  const st = await ServicioTienda.findByPk(id_servicio_tienda, {
    include: [
      {
        model: Servicio,
        as: "servicio",
        include: [{ model: Producto, as: "producto" }],
      },
    ],
  });
  if (!st) {
    throwError("El registro de servicio-tienda no existe.", 404);
  }
  if (!st.servicio || !st.servicio.producto) {
    throwError("El servicio seleccionado no es un producto. Solo se permiten entradas para productos.", 400);
  }
  const isVencible = st.servicio.producto.isVencible;
  return { st, isVencible };
};

// Actualizar cantidad en ServicioTienda sumando o restando
const updateCantidadServicioTienda = async (id_servicio_tienda, delta, transaction) => {
  const st = await ServicioTienda.findByPk(id_servicio_tienda, { transaction });
  if (!st) {
    throwError("Servicio-tienda no encontrado.", 404);
  }
  const newCantidad = parseFloat(st.cantidad || 0) + delta;
  if (newCantidad < 0) {
    throwError("La operación dejaría la cantidad del producto en la tienda negativa. Verifique el inventario.", 400);
  }
  await st.update({ cantidad: newCantidad }, { transaction });
};

// Obtener entrada con relaciones (para respuesta)
const getEntradaWithRelations = async (id) => {
  const entrada = await Entrada.findByPk(id, {
    include: [
      { model: Usuario, as: "usuario" },
      {
        model: ServicioTienda,
        as: "servicioTienda",
        include: [
          { model: Tienda, as: "tienda" },
          { model: Servicio, as: "servicio", include: [{ model: Producto, as: "producto" }] },
        ],
      },
    ],
  });
  if (!entrada) throwError("Entrada no encontrada.", 404);
  return entrada;
};

// Validar que el usuario exista
const validateUsuarioExists = async (id_usuario) => {
  const count = await Usuario.count({ where: { id_usuario } });
  if (count === 0) {
    throwError("El usuario especificado no existe.", 404);
  }
};

// ========== FUNCIONES PRINCIPALES ==========

const createEntrada = async (entradaData) => {
  const { id_servicio_tienda, cantidad_entrada, costo_usd, costo_cup, fecha_vencimiento, nombre_proveedor, id_usuario, fecha } = entradaData;

  if (!id_usuario) throwError("El ID de usuario es requerido.", 400);
  await validateUsuarioExists(id_usuario);

  const transaction = await Entrada.sequelize.transaction();

  try {
    const { st, isVencible } = await validateServicioTiendaProducto(id_servicio_tienda);

    if (isVencible && !fecha_vencimiento) {
      throwError("El producto requiere fecha de vencimiento, este campo es obligatorio.", 400);
    }

    const sufijo = st.servicio.producto.sufijo;
    const codigo_lote = await generateCodigoLote(sufijo);

    const fechaRegistro = fecha ? new Date(fecha) : new Date();

    const nuevaEntrada = await Entrada.create(
      {
        id_usuario,
        id_servicio_tienda,
        codigo_lote,
        cantidad_entrada,
        cantidad_restante: cantidad_entrada,
        costo_usd,
        costo_cup,
        fecha: fechaRegistro,
        fecha_vencimiento: fecha_vencimiento || null,
        nombre_proveedor: nombre_proveedor || null,
      },
      { transaction }
    );

    await updateCantidadServicioTienda(id_servicio_tienda, cantidad_entrada, transaction);

    await transaction.commit();

    return await getEntradaWithRelations(nuevaEntrada.id_entrada);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const getEntradaById = async (id) => {
  return await getEntradaWithRelations(id);
};

const updateEntrada = async (id, updateData) => {
  const transaction = await Entrada.sequelize.transaction();

  try {
    // 1. Obtener la entrada actual
    const entrada = await Entrada.findByPk(id, { transaction });
    if (!entrada) throwError("Entrada no encontrada.", 404);

    // 2. No se permite modificar codigo_lote ni cantidad_restante
    if (updateData.codigo_lote !== undefined) {
      throwError("No se puede modificar el código de lote.", 400);
    }
    if (updateData.cantidad_restante !== undefined) {
      throwError("No se puede modificar la cantidad restante manualmente.", 400);
    }

    // 3. Validar usuario si se envía
    if (updateData.id_usuario) {
      await validateUsuarioExists(updateData.id_usuario);
    }

    // 4. Variables para manejar el cambio de servicio_tienda
    let currentServicioTiendaId = entrada.id_servicio_tienda;
    let newServicioTiendaId = currentServicioTiendaId;
    let isChangingServicioTienda = false;

    if (updateData.id_servicio_tienda !== undefined) {
      if (updateData.id_servicio_tienda === currentServicioTiendaId) {
        // Si es el mismo, no hacemos nada
      } else {
        newServicioTiendaId = updateData.id_servicio_tienda;
        isChangingServicioTienda = true;
        // Validar que el nuevo servicio_tienda exista y sea producto
        await validateServicioTiendaProducto(newServicioTiendaId);
      }
    }

    // 5. Validar fecha de vencimiento según producto del servicio_tienda (nuevo o actual)
    let targetServicioTiendaId = isChangingServicioTienda ? newServicioTiendaId : currentServicioTiendaId;
    const { isVencible } = await validateServicioTiendaProducto(targetServicioTiendaId);

    let newFechaVencimiento = updateData.fecha_vencimiento !== undefined ? updateData.fecha_vencimiento : entrada.fecha_vencimiento;
    if (isVencible && !newFechaVencimiento) {
      throwError("El producto requiere fecha de vencimiento, este campo es obligatorio.", 400);
    }

    // 6. Preparar campos a actualizar
    const updateFields = {};
    let deltaCantidad = 0;
    let cantidadEntradaActual = parseFloat(entrada.cantidad_entrada);
    let nuevaCantidadEntrada = cantidadEntradaActual;

    if (updateData.cantidad_entrada !== undefined) {
      const newCantidad = parseFloat(updateData.cantidad_entrada);
      if (isNaN(newCantidad) || newCantidad <= 0) {
        throwError("La cantidad de entrada debe ser un número mayor que cero.", 400);
      }
      deltaCantidad = newCantidad - cantidadEntradaActual;
      nuevaCantidadEntrada = newCantidad;
      updateFields.cantidad_entrada = newCantidad;
      updateFields.cantidad_restante = newCantidad;
    }

    if (updateData.costo_usd !== undefined) {
      if (isNaN(updateData.costo_usd) || updateData.costo_usd < 0) {
        throwError("El costo en USD no puede ser negativo.", 400);
      }
      updateFields.costo_usd = updateData.costo_usd;
    }
    if (updateData.costo_cup !== undefined) {
      if (isNaN(updateData.costo_cup) || updateData.costo_cup < 0) {
        throwError("El costo en CUP no puede ser negativo.", 400);
      }
      updateFields.costo_cup = updateData.costo_cup;
    }
    if (updateData.fecha_vencimiento !== undefined) {
      updateFields.fecha_vencimiento = updateData.fecha_vencimiento || null;
    }
    if (updateData.nombre_proveedor !== undefined) {
      updateFields.nombre_proveedor = updateData.nombre_proveedor || null;
    }
    if (updateData.id_usuario !== undefined) {
      updateFields.id_usuario = updateData.id_usuario;
    }
    if (updateData.fecha !== undefined) {
      const fechaObj = new Date(updateData.fecha);
      if (isNaN(fechaObj.getTime())) throwError("La fecha proporcionada no es válida.", 400);
      updateFields.fecha = fechaObj;
    }

    if (isChangingServicioTienda) {
      updateFields.id_servicio_tienda = newServicioTiendaId;
    }

    if (Object.keys(updateFields).length === 0) {
      throwError("No se proporcionaron campos válidos para actualizar.", 400);
    }

    // 7. Aplicar cambios en orden:
    // - Si cambia servicio_tienda:
    //   a) Restar cantidad_entrada (la actual o la nueva si cambia) del antiguo
    //   b) Sumar cantidad_entrada (la nueva) al nuevo
    // - Si no cambia, solo ajustar la cantidad si cambia cantidad_entrada

    // Determinar la cantidad a usar para las operaciones de inventario
    const cantidadAUsar = deltaCantidad !== 0 ? nuevaCantidadEntrada : cantidadEntradaActual;

    if (isChangingServicioTienda) {
      // Restar del antiguo
      await updateCantidadServicioTienda(currentServicioTiendaId, -cantidadAUsar, transaction);
      // Sumar al nuevo
      await updateCantidadServicioTienda(newServicioTiendaId, cantidadAUsar, transaction);
    } else if (deltaCantidad !== 0) {
      // Solo ajustar la cantidad en el mismo servicio_tienda
      await updateCantidadServicioTienda(currentServicioTiendaId, deltaCantidad, transaction);
    }

    // 8. Actualizar la entrada
    await entrada.update(updateFields, { transaction });

    await transaction.commit();

    return await getEntradaWithRelations(id);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const deleteEntrada = async (id) => {
  const transaction = await Entrada.sequelize.transaction();

  try {
    const entrada = await Entrada.findByPk(id, { transaction });
    if (!entrada) throwError("Entrada no encontrada.", 404);

    await updateCantidadServicioTienda(entrada.id_servicio_tienda, -entrada.cantidad_entrada, transaction);

    await entrada.destroy({ transaction });

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const filterEntradas = async (filters, limit, offset) => {
  const where = {};

  if (filters.id_servicio_tienda) where.id_servicio_tienda = filters.id_servicio_tienda;
  if (filters.id_usuario) where.id_usuario = filters.id_usuario;
  if (filters.codigo_lote) where.codigo_lote = { [Op.iLike]: `%${filters.codigo_lote}%` };

  if (filters.fecha_desde || filters.fecha_hasta) {
    where.fecha = {};
    if (filters.fecha_desde) where.fecha[Op.gte] = filters.fecha_desde;
    if (filters.fecha_hasta) {
      const end = new Date(filters.fecha_hasta);
      end.setDate(end.getDate() + 1);
      where.fecha[Op.lt] = end;
    }
  }

  // Construir condiciones para ServicioTienda
  const servicioTiendaWhere = {};
  if (filters.id_tienda) servicioTiendaWhere.id_tienda = filters.id_tienda;
  if (filters.id_servicio) servicioTiendaWhere.id_servicio = filters.id_servicio;

  const include = [
    {
      model: ServicioTienda,
      as: "servicioTienda",
      include: [
        {
          model: Servicio,
          as: "servicio",
          include: [{ model: Producto, as: "producto" }],
        },
        { model: Tienda, as: "tienda" },
      ],
    },
    { model: Usuario, as: "usuario" },
  ];

  // Si hay filtros sobre ServicioTienda, aplicarlos como INNER JOIN
  if (Object.keys(servicioTiendaWhere).length > 0) {
    include[0].required = true;
    include[0].where = servicioTiendaWhere;
  }

  // Filtro por nombre de servicio (sobre el modelo Servicio anidado)
  if (filters.nombre_servicio) {
    include[0].include[0].where = {
      nombre: { [Op.iLike]: `%${filters.nombre_servicio}%` },
    };
  }

  const { rows, count } = await Entrada.findAndCountAll({
    where,
    include,
    order: [["fecha", "DESC"]],
    limit,
    offset,
    distinct: true,
  });
  
  return { rows, count };
};

module.exports = {
  createEntrada,
  getEntradaById,
  updateEntrada,
  deleteEntrada,
  filterEntradas,
};