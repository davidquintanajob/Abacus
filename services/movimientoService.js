const { Movimiento } = require("../models/movimiento");
const { MovimientoLista } = require("../models/movimiento_lista");
const { MovimientoEntrada } = require("../models/movimiento_entrada");
const { MovimientoMovimiento } = require("../models/movimiento_movimiento");
const { Entrada } = require("../models/entrada");
const { ServicioTienda } = require("../models/servicio_tienda");
const { Servicio } = require("../models/servicio");
const { Producto } = require("../models/producto");
const { Usuario } = require("../models/usuario");
const { Tienda } = require("../models/tienda");
const { Op, Sequelize } = require("sequelize");
const { throwError } = require("../helpers/errorLauncher");

// ===== FUNCIONES AUXILIARES =====

/**
 * Obtiene una lista de movimientos con todas las relaciones.
 */
const getMovimientoListaWithRelations = async (id) => {
  const lista = await MovimientoLista.findByPk(id, {
    include: [
      { model: Usuario, as: "usuario" },
      {
        model: Movimiento,
        as: "movimientos",
        include: [
          { model: Tienda, as: "tiendaOrigen" },
          { model: Tienda, as: "tiendaDestino" },
          { model: Servicio, as: "servicio", include: [{ model: Producto, as: "producto" }] },
          {
            model: MovimientoEntrada,
            as: "movimientoEntradas",
            include: [{ model: Entrada, as: "entrada" }],
          },
        ],
      },
    ],
    order: [[{ model: Movimiento, as: "movimientos" }, "id_movimiento", "ASC"]],
  });
  if (!lista) throwError("Movimiento no encontrado.", 404);
  await attachServicioTiendaRelations(lista.movimientos);
  return lista;
};

/**
 * Incluye las relaciones de inventario que exponía la respuesta antes del cambio.
 */
const attachServicioTiendaRelations = async (movimientos) => {
  await Promise.all(movimientos.map(async (movimiento) => {
    const [origen, destino] = await Promise.all([
      ServicioTienda.findOne({
        where: {
          id_tienda: movimiento.id_tienda_origen,
          id_servicio: movimiento.id_servicio,
        },
        include: [
          { model: Tienda, as: "tienda" },
          { model: Servicio, as: "servicio", include: [{ model: Producto, as: "producto" }] },
        ],
      }),
      ServicioTienda.findOne({
        where: {
          id_tienda: movimiento.id_tienda_destino,
          id_servicio: movimiento.id_servicio,
        },
        include: [
          { model: Tienda, as: "tienda" },
          { model: Servicio, as: "servicio", include: [{ model: Producto, as: "producto" }] },
        ],
      }),
    ]);
    movimiento.setDataValue("servicioTiendaOrigen", origen);
    movimiento.setDataValue("servicioTiendaDestino", destino);
  }));
};

const findServicioTienda = async (id_tienda, id_servicio, transaction) => {
  return await ServicioTienda.findOne({
    where: { id_tienda, id_servicio },
    include: [
      {
        model: Servicio,
        as: "servicio",
        include: [{ model: Producto, as: "producto" }],
      },
      { model: Tienda, as: "tienda" },
    ],
    transaction,
  });
};

const resolveMovimientoItems = async (movimientos, estado, transaction) => {
  if (!Array.isArray(movimientos) || movimientos.length === 0) {
    throwError("La lista de movimientos no puede estar vacía.", 400);
  }

  const resolved = [];
  for (let i = 0; i < movimientos.length; i++) {
    const item = movimientos[i];
    const idx = i + 1;

    if (!item.id_servicio) throwError(`Movimiento ${idx}: id_servicio es obligatorio.`, 400);
    if (!item.id_tienda_origen) throwError(`Movimiento ${idx}: id_tienda_origen es obligatorio.`, 400);
    if (!item.id_tienda_destino) throwError(`Movimiento ${idx}: id_tienda_destino es obligatorio.`, 400);
    if (item.cantidad === undefined || item.cantidad === null || isNaN(item.cantidad) || item.cantidad <= 0) {
      throwError(`Movimiento ${idx}: cantidad debe ser un número mayor que cero.`, 400);
    }
    if (item.id_tienda_origen === item.id_tienda_destino) {
      throwError(`Movimiento ${idx}: el origen y el destino no pueden ser la misma tienda.`, 400);
    }

    const stOrigen = await findServicioTienda(item.id_tienda_origen, item.id_servicio, transaction);
    if (!stOrigen) {
      throwError(`El producto ${item.id_servicio} no existe en la tienda origen ${item.id_tienda_origen}.`, 404);
    }
    if (!stOrigen.servicio || !stOrigen.servicio.producto) {
      throwError(`El servicio ${item.id_servicio} no está asociado a un producto.`, 400);
    }

    let stDestino = await findServicioTienda(item.id_tienda_destino, item.id_servicio, transaction);
    if (!stDestino) {
      const tiendaDestino = await Tienda.findByPk(item.id_tienda_destino, { transaction });
      if (!tiendaDestino) throwError(`La tienda destino ${item.id_tienda_destino} no existe.`, 404);

      stDestino = await ServicioTienda.create(
        {
          id_tienda: item.id_tienda_destino,
          id_servicio: item.id_servicio,
          precio_cup: stOrigen.precio_cup,
          precio_usd: stOrigen.precio_usd,
          costo_cup: stOrigen.costo_cup,
          costo_usd: stOrigen.costo_usd,
          cantidad: 0,
          cantidad_alerta: stOrigen.cantidad_alerta,
        },
        { transaction }
      );
      stDestino.setDataValue("tienda", tiendaDestino);
      stDestino.setDataValue("servicio", stOrigen.servicio);
    }

    if (estado) {
      const stockOrigen = parseFloat(stOrigen.cantidad || 0);
      if (stockOrigen < item.cantidad) {
        throwError(
          `Movimiento ${idx}: stock insuficiente en la tienda origen "${stOrigen.tienda.nombre}" para el producto "${stOrigen.servicio.nombre}". Disponible: ${stockOrigen}, solicitado: ${item.cantidad}`,
          400
        );
      }
    }

    resolved.push({ ...item, stOrigen, stDestino });
  }
  return resolved;
};

/**
 * Obtiene las entradas disponibles (cantidad_restante > 0) para un servicio_tienda.
 */
const getEntradasDisponibles = async (id_servicio_tienda, isVencible, transaction) => {
  const where = {
    id_servicio_tienda,
    cantidad_restante: { [Op.gt]: 0 },
  };
  let order = [];
  if (isVencible) {
    order = [
      [Sequelize.literal('CASE WHEN "fecha_vencimiento" IS NULL THEN 1 ELSE 0 END'), 'ASC'],
      ['fecha_vencimiento', 'ASC NULLS LAST'],
      ['fecha', 'ASC'],
    ];
  } else {
    order = [['fecha', 'ASC']];
  }
  return await Entrada.findAll({ where, order, transaction });
};

/**
 * Descuenta primero de las entradas y luego de los movimientos recibidos en origen.
 */
const descontarEntradasParaMovimiento = async (id_movimiento, id_servicio_tienda_origen, cantidadTotal, transaction) => {
  const st = await ServicioTienda.findByPk(id_servicio_tienda_origen, {
    include: [
      {
        model: Servicio,
        as: "servicio",
        include: [{ model: Producto, as: "producto" }],
      },
    ],
    transaction,
  });
  if (!st) throwError("Servicio-tienda origen no encontrado", 404);
  const isVencible = st.servicio.producto.isVencible;

  const entradas = await getEntradasDisponibles(id_servicio_tienda_origen, isVencible, transaction);

  let cantidadPendiente = cantidadTotal;
  for (const entrada of entradas) {
    if (cantidadPendiente <= 0) break;
    const disponible = entrada.cantidad_restante;
    const cantidadAUsar = Math.min(disponible, cantidadPendiente);

    await entrada.update(
      { cantidad_restante: entrada.cantidad_restante - cantidadAUsar },
      { transaction }
    );
    await MovimientoEntrada.create(
      {
        id_movimiento,
        id_entrada: entrada.id_entrada,
        cantidad: cantidadAUsar,
      },
      { transaction }
    );
    cantidadPendiente -= cantidadAUsar;
  }

  if (cantidadPendiente > 0) {
    const movimientosOrigen = await Movimiento.findAll({
      where: {
        id_tienda_destino: st.id_tienda,
        id_servicio: st.id_servicio,
        cantidad_restante: { [Op.gt]: 0 },
      },
      include: [{
        model: MovimientoLista,
        as: "movimientoLista",
        required: true,
        where: { estado: true },
      }],
      order: [
        [{ model: MovimientoLista, as: "movimientoLista" }, "fecha_hora", "ASC"],
        ["id_movimiento", "ASC"],
      ],
      transaction,
    });

    for (const movimientoOrigen of movimientosOrigen) {
      if (cantidadPendiente <= 0) break;
      const disponible = parseFloat(movimientoOrigen.cantidad_restante);
      const cantidadAUsar = Math.min(disponible, cantidadPendiente);

      await movimientoOrigen.update(
        { cantidad_restante: disponible - cantidadAUsar },
        { transaction }
      );
      await MovimientoMovimiento.create(
        {
          id_movimiento,
          id_movimiento_origen: movimientoOrigen.id_movimiento,
          cantidad: cantidadAUsar,
        },
        { transaction }
      );
      cantidadPendiente -= cantidadAUsar;
    }
  }

  if (cantidadPendiente > 0) {
    throwError("No hay suficiente cantidad en las entradas y movimientos para cubrir el movimiento.", 400);
  }
};

/**
 * Revierte las entradas de un movimiento (suma cantidad_restante de vuelta).
 */
const revertirMovimientoEntradas = async (id_movimiento, transaction) => {
  const movimientoEntradas = await MovimientoEntrada.findAll({
    where: { id_movimiento },
    transaction,
  });
  const movimiento = await Movimiento.findByPk(id_movimiento, { transaction });
  let cantidadPendiente = parseFloat(movimiento?.cantidad_restante || 0);

  for (const me of movimientoEntradas) {
    if (cantidadPendiente <= 0) {
      await me.destroy({ transaction });
      continue;
    }
    const entrada = await Entrada.findByPk(me.id_entrada, { transaction });
    if (!entrada) {
      throwError(
        "No se puede revertir el movimiento porque una de sus entradas de origen ya no existe.",
        400
      );
    }
    const cantidadADevolver = Math.min(parseFloat(me.cantidad), cantidadPendiente);
    await entrada.update(
      { cantidad_restante: parseFloat(entrada.cantidad_restante) + cantidadADevolver },
      { transaction }
    );
    cantidadPendiente -= cantidadADevolver;
    await me.destroy({ transaction });
  }

  const movimientosOrigen = await MovimientoMovimiento.findAll({
    where: { id_movimiento },
    transaction,
  });
  for (const mm of movimientosOrigen) {
    if (cantidadPendiente <= 0) {
      await mm.destroy({ transaction });
      continue;
    }
    const movimientoOrigen = await Movimiento.findByPk(mm.id_movimiento_origen, { transaction });
    if (!movimientoOrigen) {
      throwError(
        "No se puede revertir el movimiento porque uno de sus movimientos de origen ya no existe.",
        400
      );
    }
    const cantidadADevolver = Math.min(parseFloat(mm.cantidad), cantidadPendiente);
    await movimientoOrigen.update(
      {
        cantidad_restante: parseFloat(movimientoOrigen.cantidad_restante || 0) + cantidadADevolver,
      },
      { transaction }
    );
    cantidadPendiente -= cantidadADevolver;
    await mm.destroy({ transaction });
  }

  if (cantidadPendiente > 0) {
    throwError("No se puede revertir el movimiento: sus fuentes de origen no cubren la cantidad restante.", 400);
  }
};

/**
 * Revierte todos los efectos de una lista de movimientos si su estado era true.
 * También elimina los movimientos (y sus movimientos_entradas por cascade).
 */
const revertirMovimientoCompleto = async (id_movimiento_lista, transaction) => {
  const lista = await MovimientoLista.findByPk(id_movimiento_lista, {
    include: [{ model: Movimiento, as: "movimientos" }],
    transaction,
  });
  if (!lista) return;

  if (lista.estado) {
    for (const mov of lista.movimientos) {
      if (parseFloat(mov.cantidad_restante) < parseFloat(mov.cantidad)) {
        throwError(
          "No se puede editar ni eliminar un movimiento que ya fue consumido por ventas. Elimine o actualice primero las ventas relacionadas.",
          400
        );
      }
      // 1. Revertir entradas del origen
      await revertirMovimientoEntradas(mov.id_movimiento, transaction);

      // 2. Sumar de vuelta al origen
      const stOrigen = await findServicioTienda(
        mov.id_tienda_origen,
        mov.id_servicio,
        transaction
      );
      if (stOrigen) {
        await stOrigen.update(
          { cantidad: parseFloat(stOrigen.cantidad || 0) + mov.cantidad },
          { transaction }
        );
      }

      // 3. Restar del destino (validar stock suficiente)
      const stDestino = await findServicioTienda(
        mov.id_tienda_destino,
        mov.id_servicio,
        transaction
      );
      if (stDestino) {
        const cantDestino = parseFloat(stDestino.cantidad || 0);
        const cantidadRestante = parseFloat(mov.cantidad_restante);
        if (cantDestino < cantidadRestante) {
          throwError(
            `No hay suficiente cantidad en el destino (tienda "${stDestino.tienda?.nombre || stDestino.id_tienda}") para revertir el movimiento. Disponible: ${cantDestino}, se necesita: ${cantidadRestante}`,
            400
          );
        }
        await stDestino.update(
          { cantidad: cantDestino - cantidadRestante },
          { transaction }
        );
      }
    }
  }

  // Eliminar movimientos (movimiento_entrada se elimina por cascade)
  await Movimiento.destroy({ where: { id_movimiento_lista }, transaction });
};

/**
 * Crea los movimientos para una lista y aplica los cambios si estado es true.
 */
const _crearMovimientosParaLista = async (id_movimiento_lista, movimientos, estado, transaction) => {
  for (const item of movimientos) {
    const movimiento = await Movimiento.create(
      {
        cantidad: item.cantidad,
        cantidad_restante: item.cantidad,
        costo_producto_cup: item.stOrigen.costo_cup,
        costo_producto_usd: item.stOrigen.costo_usd,
        nota: item.nota || null,
        id_tienda_origen: item.id_tienda_origen,
        id_tienda_destino: item.id_tienda_destino,
        id_servicio: item.id_servicio,
        id_movimiento_lista,
      },
      { transaction }
    );

    if (estado) {
      // 1. Descontar entradas del origen
      await descontarEntradasParaMovimiento(
        movimiento.id_movimiento,
        item.stOrigen.id_servicio_tienda,
        item.cantidad,
        transaction
      );

      // 2. Restar del stock del origen
      const stOrigen = await ServicioTienda.findByPk(item.stOrigen.id_servicio_tienda, { transaction });
      await stOrigen.update(
        { cantidad: parseFloat(stOrigen.cantidad || 0) - item.cantidad },
        { transaction }
      );

      // 3. Sumar al stock del destino
      const stDestino = await ServicioTienda.findByPk(item.stDestino.id_servicio_tienda, { transaction });
      await stDestino.update(
        { cantidad: parseFloat(stDestino.cantidad || 0) + item.cantidad },
        { transaction }
      );
    }
  }
};

// ===== FUNCIONES PRINCIPALES =====

const getMovimientoById = async (id) => {
  return await getMovimientoListaWithRelations(id);
};

const createMovimiento = async (data) => {
  const { id_usuario, fecha_hora, tipo_movimiento, estado, nota, movimientos } = data;

  // Validar usuario
  const usuario = await Usuario.findByPk(id_usuario);
  if (!usuario) throwError("Usuario no encontrado.", 404);

  const transaction = await MovimientoLista.sequelize.transaction();

  try {
    const resolvedMovimientos = await resolveMovimientoItems(movimientos, estado, transaction);

    // Crear la lista
    const nuevaLista = await MovimientoLista.create(
      {
        id_usuario,
        fecha_hora,
        tipo_movimiento,
        estado,
        nota,
      },
      { transaction }
    );

    // Crear movimientos y aplicar lógica
    await _crearMovimientosParaLista(
      nuevaLista.id_movimiento_lista,
      resolvedMovimientos,
      estado,
      transaction
    );

    await transaction.commit();
    return await getMovimientoListaWithRelations(nuevaLista.id_movimiento_lista);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const updateMovimiento = async (id, data) => {
  const { id_usuario, fecha_hora, tipo_movimiento, estado, nota, movimientos } = data;

  // Validar usuario
  const usuario = await Usuario.findByPk(id_usuario);
  if (!usuario) throwError("Usuario no encontrado.", 404);

  const transaction = await MovimientoLista.sequelize.transaction();

  try {
    // Verificar que la lista existe
    const listaExistente = await MovimientoLista.findByPk(id, { transaction });
    if (!listaExistente) throwError("Movimiento no encontrado.", 404);

    // 1. Revertir todos los efectos anteriores (si estado era true) y eliminar movimientos
    await revertirMovimientoCompleto(id, transaction);

    const resolvedMovimientos = await resolveMovimientoItems(movimientos, estado, transaction);

    // 2. Actualizar datos de la lista
    await listaExistente.update(
      {
        id_usuario,
        fecha_hora,
        tipo_movimiento,
        estado,
        nota,
      },
      { transaction }
    );

    // 3. Volver a crear los movimientos con los nuevos datos
    await _crearMovimientosParaLista(id, resolvedMovimientos, estado, transaction);

    await transaction.commit();
    return await getMovimientoListaWithRelations(id);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const deleteMovimiento = async (id) => {
  const transaction = await MovimientoLista.sequelize.transaction();

  try {
    const lista = await MovimientoLista.findByPk(id, { transaction });
    if (!lista) throwError("Movimiento no encontrado.", 404);

    // Revertir todos los efectos y eliminar los movimientos
    await revertirMovimientoCompleto(id, transaction);

    // Eliminar la lista
    await lista.destroy({ transaction });

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const filterMovimientos = async (filters, limit, offset) => {
  const where = {};

  if (filters.id_usuario) where.id_usuario = filters.id_usuario;
  if (filters.tipo_movimiento) where.tipo_movimiento = { [Op.iLike]: `%${filters.tipo_movimiento}%` };
  if (filters.estado !== undefined) where.estado = filters.estado;

  if (filters.fecha_desde || filters.fecha_hasta) {
    where.fecha_hora = {};
    if (filters.fecha_desde) where.fecha_hora[Op.gte] = filters.fecha_desde;
    if (filters.fecha_hasta) {
      const end = new Date(filters.fecha_hasta);
      end.setDate(end.getDate() + 1);
      where.fecha_hora[Op.lt] = end;
    }
  }

  const movimientoWhere = {};
  if (filters.id_tienda_origen && filters.id_tienda_destino) {
    movimientoWhere[Op.or] = [
      { id_tienda_origen: filters.id_tienda_origen },
      { id_tienda_destino: filters.id_tienda_destino },
    ];
  } else if (filters.id_tienda_origen) {
    movimientoWhere.id_tienda_origen = filters.id_tienda_origen;
  } else if (filters.id_tienda_destino) {
    movimientoWhere.id_tienda_destino = filters.id_tienda_destino;
  }
  if (filters.id_servicio) movimientoWhere.id_servicio = filters.id_servicio;

  const include = [
    { model: Usuario, as: "usuario" },
    {
      model: Movimiento,
      as: "movimientos",
      include: [
        { model: Tienda, as: "tiendaOrigen" },
        { model: Tienda, as: "tiendaDestino" },
        { model: Servicio, as: "servicio", include: [{ model: Producto, as: "producto" }] },
        {
          model: MovimientoEntrada,
          as: "movimientoEntradas",
          include: [{ model: Entrada, as: "entrada" }],
        },
      ],
    },
  ];

  if (Object.keys(movimientoWhere).length > 0) {
    include[1].required = true;
    include[1].where = movimientoWhere;
  }

  const { rows, count } = await MovimientoLista.findAndCountAll({
    where,
    include,
    order: [["fecha_hora", "DESC"]],
    limit,
    offset,
    distinct: true,
  });

  await Promise.all(rows.map((lista) => attachServicioTiendaRelations(lista.movimientos)));
  return { rows, count };
};

module.exports = {
  getMovimientoById,
  filterMovimientos,
  createMovimiento,
  updateMovimiento,
  deleteMovimiento,
};