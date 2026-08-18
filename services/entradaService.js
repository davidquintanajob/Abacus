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

// ===== FUNCIÓN AUXILIAR PARA CREAR UNA SOLA ENTRADA (usada por createEntrada y createEntradasBulk) =====
const createSingleEntrada = async (entradaData, transaction) => {
  const { id_servicio_tienda, cantidad_entrada, costo_usd, costo_cup, fecha_vencimiento, nombre_proveedor, id_usuario, fecha } = entradaData;

  await validateUsuarioExists(id_usuario);

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

  return nuevaEntrada;
};

// ========== FUNCIONES PRINCIPALES ==========

const createEntrada = async (entradaData) => {
  const { id_usuario } = entradaData;
  if (!id_usuario) throwError("El ID de usuario es requerido.", 400);
  await validateUsuarioExists(id_usuario);

  const transaction = await Entrada.sequelize.transaction();

  try {
    const nuevaEntrada = await createSingleEntrada(entradaData, transaction);
    await transaction.commit();
    return await getEntradaWithRelations(nuevaEntrada.id_entrada);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const createEntradasBulk = async (entradasData) => {
  if (!Array.isArray(entradasData) || entradasData.length === 0) {
    throwError("La lista de entradas no puede estar vacía.", 400);
  }

  // Validar que todos los usuarios existan
  const userIds = entradasData.map(item => item.id_usuario);
  for (const uid of userIds) {
    if (!uid) {
      throwError("Todas las entradas deben tener un ID de usuario válido.", 400);
    }
    await validateUsuarioExists(uid);
  }

  const transaction = await Entrada.sequelize.transaction();

  try {
    const createdEntradas = [];
    for (const data of entradasData) {
      const nuevaEntrada = await createSingleEntrada(data, transaction);
      createdEntradas.push(nuevaEntrada);
    }
    await transaction.commit();

    const ids = createdEntradas.map(e => e.id_entrada);
    const entradasConRelaciones = await Entrada.findAll({
      where: { id_entrada: { [Op.in]: ids } },
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
      order: [["id_entrada", "ASC"]],
    });
    return entradasConRelaciones;
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
    const entrada = await Entrada.findByPk(id, { transaction });
    if (!entrada) throwError("Entrada no encontrada.", 404);

    if (updateData.codigo_lote !== undefined) {
      throwError("No se puede modificar el código de lote.", 400);
    }
    if (updateData.cantidad_restante !== undefined) {
      throwError("No se puede modificar la cantidad restante manualmente.", 400);
    }

    if (updateData.id_usuario) {
      await validateUsuarioExists(updateData.id_usuario);
    }

    let currentServicioTiendaId = entrada.id_servicio_tienda;
    let newServicioTiendaId = currentServicioTiendaId;
    let isChangingServicioTienda = false;

    if (updateData.id_servicio_tienda !== undefined) {
      if (updateData.id_servicio_tienda === currentServicioTiendaId) {
        // mismo, no hacer nada
      } else {
        newServicioTiendaId = updateData.id_servicio_tienda;
        isChangingServicioTienda = true;
        await validateServicioTiendaProducto(newServicioTiendaId);
      }
    }

    let targetServicioTiendaId = isChangingServicioTienda ? newServicioTiendaId : currentServicioTiendaId;
    const { isVencible } = await validateServicioTiendaProducto(targetServicioTiendaId);

    let newFechaVencimiento = updateData.fecha_vencimiento !== undefined ? updateData.fecha_vencimiento : entrada.fecha_vencimiento;
    if (isVencible && !newFechaVencimiento) {
      throwError("El producto requiere fecha de vencimiento, este campo es obligatorio.", 400);
    }

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

    const cantidadAUsar = deltaCantidad !== 0 ? nuevaCantidadEntrada : cantidadEntradaActual;

    if (isChangingServicioTienda) {
      await updateCantidadServicioTienda(currentServicioTiendaId, -cantidadAUsar, transaction);
      await updateCantidadServicioTienda(newServicioTiendaId, cantidadAUsar, transaction);
    } else if (deltaCantidad !== 0) {
      await updateCantidadServicioTienda(currentServicioTiendaId, deltaCantidad, transaction);
    }

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

  // Filtros directos
  if (filters.id_servicio_tienda) where.id_servicio_tienda = filters.id_servicio_tienda;
  if (filters.id_usuario) where.id_usuario = filters.id_usuario;
  if (filters.codigo_lote) where.codigo_lote = { [Op.iLike]: `%${filters.codigo_lote}%` };

  // Filtro por fecha de creación
  if (filters.fecha_desde || filters.fecha_hasta) {
    where.fecha = {};
    if (filters.fecha_desde) where.fecha[Op.gte] = filters.fecha_desde;
    if (filters.fecha_hasta) {
      const end = new Date(filters.fecha_hasta);
      end.setDate(end.getDate() + 1);
      where.fecha[Op.lt] = end;
    }
  }

  // Filtro por cantidad_restante
  if (filters.cantidad_restante_min !== undefined && filters.cantidad_restante_max !== undefined) {
    where.cantidad_restante = { [Op.between]: [filters.cantidad_restante_min, filters.cantidad_restante_max] };
  } else if (filters.cantidad_restante_min !== undefined) {
    where.cantidad_restante = { [Op.gte]: filters.cantidad_restante_min };
  } else if (filters.cantidad_restante_max !== undefined) {
    where.cantidad_restante = { [Op.lte]: filters.cantidad_restante_max };
  }

  // Filtro por fecha_vencimiento
  if (filters.fecha_vencimiento_desde && filters.fecha_vencimiento_hasta) {
    where.fecha_vencimiento = { [Op.between]: [filters.fecha_vencimiento_desde, filters.fecha_vencimiento_hasta] };
  } else if (filters.fecha_vencimiento_desde) {
    where.fecha_vencimiento = { [Op.gte]: filters.fecha_vencimiento_desde };
  } else if (filters.fecha_vencimiento_hasta) {
    where.fecha_vencimiento = { [Op.lte]: filters.fecha_vencimiento_hasta };
  }

  // Construir include con condiciones anidadas
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

  if (Object.keys(servicioTiendaWhere).length > 0) {
    include[0].required = true;
    include[0].where = servicioTiendaWhere;
  }

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
  createEntradasBulk,
  getEntradaById,
  updateEntrada,
  deleteEntrada,
  filterEntradas,
};