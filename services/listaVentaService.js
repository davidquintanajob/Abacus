const { ListaVenta } = require("../models/lista_venta");
const { Venta } = require("../models/venta");
const { VentaEntrada } = require("../models/venta_entrada");
const { Entrada } = require("../models/entrada");
const { ServicioTienda } = require("../models/servicio_tienda");
const { Servicio } = require("../models/servicio");
const { Producto } = require("../models/producto");
const { Tienda } = require("../models/tienda");
const { Usuario } = require("../models/usuario");
const { Cuenta } = require("../models/cuenta");
const { Operacion } = require("../models/operacion");
const { Oferta } = require("../models/oferta");
const { Op, Sequelize } = require("sequelize");
const { throwError } = require("../helpers/errorLauncher");

// ===== FUNCIONES AUXILIARES =====

// Obtener lista con todas sus relaciones (para respuestas)
const getListaVentaWithRelations = async (id) => {
  const lista = await ListaVenta.findByPk(id, {
    include: [
      {
        model: Venta,
        as: "ventas",
        include: [
          {
            model: ServicioTienda,
            as: "servicioTienda",
            include: [
              { model: Tienda, as: "tienda" },
              { model: Servicio, as: "servicio", include: [{ model: Producto, as: "producto" }] },
            ],
          },
          {
            model: VentaEntrada,
            as: "ventaEntradas",
            include: [{ model: Entrada, as: "entrada" }],
          },
        ],
      },
      {
        model: Operacion,
        as: "operaciones",
        include: [
          { model: Usuario, as: "usuario" },
          { model: Cuenta, as: "cuenta" },
        ],
      },
    ],
    order: [
      [{ model: Venta, as: "ventas" }, "id_venta", "ASC"],
      [{ model: Operacion, as: "operaciones" }, "id_operacion", "ASC"],
    ],
  });
  if (!lista) throwError("Lista de ventas no encontrada.", 404);
  return lista;
};

// Validar que un servicio_tienda exista y sea producto, devolver el registro con relaciones
const validateServicioTiendaProducto = async (id_servicio_tienda, requireProduct = true) => {
  const st = await ServicioTienda.findByPk(id_servicio_tienda, {
    include: [
      {
        model: Servicio,
        as: "servicio",
        include: [{ model: Producto, as: "producto" }],
      },
      { model: Tienda, as: "tienda" },
    ],
  });
  if (!st) {
    throwError(`El servicio-tienda con id ${id_servicio_tienda} no existe.`, 404);
  }
  if (!st.servicio) {
    throwError(`El servicio-tienda ${id_servicio_tienda} no tiene un servicio asociado.`, 400);
  }
  if (requireProduct && !st.servicio.producto) {
    throwError(`El servicio-tienda ${id_servicio_tienda} no está asociado a un producto.`, 400);
  }
  return st;
};

// Validar que una cuenta exista y corresponda al tipo de cobro
const validateCuentaExists = async (id_cuenta, tipoCuentaEsperado) => {
  const cuenta = await Cuenta.findByPk(id_cuenta);
  if (!cuenta) throwError(`La cuenta con id ${id_cuenta} no existe.`, 404);
  if (cuenta.tipo_cuenta !== tipoCuentaEsperado) {
    throwError(
      `La cuenta con id ${id_cuenta} debe ser de tipo "${tipoCuentaEsperado}". Tipo actual: "${cuenta.tipo_cuenta}".`,
      400
    );
  }
  return cuenta;
};

const resolverComponentesVenta = async (servicioTienda, cantidad, transaction = null, ruta = []) => {
  const idServicio = servicioTienda.id_servicio;
  if (ruta.includes(idServicio)) {
    throwError("La oferta contiene una referencia circular entre sus componentes.", 400);
  }

  const componentes = await Oferta.findAll({
    where: { id_servicio_oferta: idServicio },
    transaction,
  });

  if (componentes.length === 0) {
    return {
      costo_cup: parseFloat(servicioTienda.costo_cup || 0) * cantidad,
      costo_usd: parseFloat(servicioTienda.costo_usd || 0) * cantidad,
      consumos: servicioTienda.servicio?.producto
        ? [{ id_servicio_tienda: servicioTienda.id_servicio_tienda, cantidad }]
        : [],
    };
  }

  let costo_cup = 0;
  let costo_usd = 0;
  const consumos = [];
  for (const componente of componentes) {
    const componenteTienda = await ServicioTienda.findOne({
      where: {
        id_tienda: servicioTienda.id_tienda,
        id_servicio: componente.id_servicio_componente,
      },
      include: [{ model: Servicio, as: "servicio", include: [{ model: Producto, as: "producto" }] }],
      transaction,
    });
    if (!componenteTienda) {
      throwError(
        `El componente ${componente.id_servicio_componente} no está configurado en la tienda ${servicioTienda.id_tienda}.`,
        400
      );
    }

    const resultado = await resolverComponentesVenta(
      componenteTienda,
      cantidad * parseFloat(componente.cantidad),
      transaction,
      [...ruta, idServicio]
    );
    costo_cup += resultado.costo_cup;
    costo_usd += resultado.costo_usd;
    consumos.push(...resultado.consumos);
  }

  return { costo_cup, costo_usd, consumos };
};

const consolidarConsumos = (consumos) => {
  const consumosPorServicioTienda = new Map();
  for (const consumo of consumos) {
    const actual = consumosPorServicioTienda.get(consumo.id_servicio_tienda) || 0;
    consumosPorServicioTienda.set(consumo.id_servicio_tienda, actual + consumo.cantidad);
  }
  return [...consumosPorServicioTienda.entries()].map(([id_servicio_tienda, cantidad]) => ({
    id_servicio_tienda,
    cantidad,
  }));
};

const aplicarConsumosVenta = async (idVenta, consumos, transaction) => {
  for (const consumo of consumos) {
    const st = await ServicioTienda.findByPk(consumo.id_servicio_tienda, { transaction });
    const stockActual = parseFloat(st?.cantidad || 0);
    if (!st || stockActual < consumo.cantidad) {
      throwError(`Stock insuficiente para el servicio-tienda ${consumo.id_servicio_tienda}.`, 400);
    }
    await descontarEntradasParaVenta(idVenta, consumo.id_servicio_tienda, consumo.cantidad, transaction);
    await st.update({ cantidad: stockActual - consumo.cantidad }, { transaction });
  }
};

const revertirConsumosVenta = async (idVenta, consumos, transaction) => {
  await revertirVentaEntradas(idVenta, transaction);
  for (const consumo of consumos) {
    const st = await ServicioTienda.findByPk(consumo.id_servicio_tienda, { transaction });
    if (st) {
      await st.update({ cantidad: parseFloat(st.cantidad || 0) + consumo.cantidad }, { transaction });
    }
  }
};

// Actualizar fondo de cuenta (suma o resta)
const actualizarFondoCuenta = async (cuentaId, delta, transaction) => {
  const cuenta = await Cuenta.findByPk(cuentaId, { transaction });
  if (!cuenta) throwError("Cuenta no encontrada.", 404);
  const nuevoFondo = parseFloat(cuenta.fondo) + delta;
  if (nuevoFondo < 0) {
    throwError(`Fondos insuficientes en la cuenta "${cuenta.nombre}". Saldo actual: ${cuenta.fondo}`, 400);
  }
  await cuenta.update({ fondo: nuevoFondo }, { transaction });
  return cuenta;
};

// ---- Funciones de descuento de entradas (similar a salidas) ----

/**
 * Obtiene las entradas disponibles con cantidad_restante > 0 para un servicio_tienda dado,
 * ordenadas según la política de despacho (FIFO por vencimiento/fecha).
 */
const getEntradasDisponibles = async (id_servicio_tienda, isVencible, transaction = null) => {
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

  const entradas = await Entrada.findAll({
    where,
    order,
    transaction,
  });
  return entradas;
};

/**
 * Descuenta una cantidad de entradas disponibles para un servicio_tienda,
 * creando registros en VentaEntrada (uno por entrada usada).
 * Similar a descontarEntradas en salidas.
 */
const descontarEntradasParaVenta = async (id_venta, id_servicio_tienda, cantidadTotal, transaction) => {
  const st = await ServicioTienda.findByPk(id_servicio_tienda, {
    include: [
      {
        model: Servicio,
        as: "servicio",
        include: [{ model: Producto, as: "producto" }],
      },
    ],
    transaction,
  });
  if (!st) throwError("Servicio-tienda no encontrado", 404);
  const isVencible = st.servicio.producto.isVencible;

  const entradas = await getEntradasDisponibles(id_servicio_tienda, isVencible, transaction);

  let cantidadPendiente = cantidadTotal;
  for (const entrada of entradas) {
    if (cantidadPendiente <= 0) break;
    const disponible = entrada.cantidad_restante;
    const cantidadAUsar = Math.min(disponible, cantidadPendiente);
    // Restar de la entrada
    await entrada.update(
      { cantidad_restante: entrada.cantidad_restante - cantidadAUsar },
      { transaction }
    );
    // Crear registro intermedio (uno por entrada)
    await VentaEntrada.create(
      {
        id_venta,
        id_entrada: entrada.id_entrada,
        cantidad: cantidadAUsar,
      },
      { transaction }
    );
    cantidadPendiente -= cantidadAUsar;
  }

  if (cantidadPendiente > 0) {
    throwError("No hay suficiente cantidad en las entradas para cubrir la venta.", 400);
  }
};

/**
 * Revertir el descuento de una venta: devolver cantidad a las entradas
 * y eliminar los registros intermedios.
 */
const revertirVentaEntradas = async (id_venta, transaction) => {
  const ventaEntradas = await VentaEntrada.findAll({
    where: { id_venta },
    transaction,
  });

  for (const ve of ventaEntradas) {
    const entrada = await Entrada.findByPk(ve.id_entrada, { transaction });
    if (entrada) {
      await entrada.update(
        { cantidad_restante: entrada.cantidad_restante + ve.cantidad },
        { transaction }
      );
    }
    await ve.destroy({ transaction });
  }
};

// ===== FUNCIONES PRINCIPALES =====

// GET by ID
const getListaVentaById = async (id) => {
  return await getListaVentaWithRelations(id);
};

const filterListaVentas = async (filters, limit, offset) => {
  const where = {};
  const andConditions = [];

  if (filters.fecha_desde || filters.fecha_hasta) {
    where.fecha_hora = {};
    if (filters.fecha_desde) where.fecha_hora[Op.gte] = filters.fecha_desde;
    if (filters.fecha_hasta) {
      const end = new Date(filters.fecha_hasta);
      end.setDate(end.getDate() + 1);
      where.fecha_hora[Op.lt] = end;
    }
  }
  if (filters.nota) where.nota = { [Op.iLike]: `%${filters.nota}%` };

  const totalCobrado = Sequelize.literal(`
    COALESCE("lista_venta"."cantidad_cobrada_efectivo_cup", 0) +
    COALESCE("lista_venta"."cantidad_cobrada_efectivo_usd", 0) +
    COALESCE("lista_venta"."cantidad_cobrada_transferencia_cup", 0) +
    COALESCE("lista_venta"."cantidad_cobrada_transferencia_usd", 0)
  `);
  if (filters.cantidad_min !== undefined) andConditions.push(Sequelize.where(totalCobrado, Op.gte, filters.cantidad_min));
  if (filters.cantidad_max !== undefined) andConditions.push(Sequelize.where(totalCobrado, Op.lte, filters.cantidad_max));

  const servicioTiendaWhere = {};
  if (filters.id_tienda !== undefined) servicioTiendaWhere.id_tienda = filters.id_tienda;
  const servicioWhere = {};
  if (filters.id_servicio !== undefined) servicioWhere.id_servicio = filters.id_servicio;
  if (filters.nombre_servicio) servicioWhere.nombre = { [Op.iLike]: `%${filters.nombre_servicio}%` };

  const hasServicioFilter = Object.keys(servicioWhere).length > 0;
  const hasServicioTiendaFilter = Object.keys(servicioTiendaWhere).length > 0;
  if (hasServicioFilter || hasServicioTiendaFilter) {
    const ventasCoincidentes = await Venta.findAll({
      attributes: ["id_lista_venta"],
      include: [
        {
          model: ServicioTienda,
          as: "servicioTienda",
          required: true,
          where: servicioTiendaWhere,
          include: [
            {
              model: Servicio,
              as: "servicio",
              required: hasServicioFilter,
              where: hasServicioFilter ? servicioWhere : undefined,
            },
          ],
        },
      ],
      raw: true,
    });
    const idsListaVenta = [...new Set(ventasCoincidentes.map((venta) => venta.id_lista_venta))];
    if (idsListaVenta.length === 0) {
      return {
        rows: [],
        count: 0,
        summary: {
          total_efectivo_cup: 0,
          total_efectivo_usd: 0,
          total_transferencia_cup: 0,
          total_transferencia_usd: 0,
        },
      };
    }
    where.id_lista_venta = { [Op.in]: idsListaVenta };
  }

  const ventasInclude = {
    model: Venta,
    as: "ventas",
    required: false,
    include: [
      {
        model: ServicioTienda,
        as: "servicioTienda",
        required: false,
        include: [
          { model: Tienda, as: "tienda" },
          {
            model: Servicio,
            as: "servicio",
            include: [{ model: Producto, as: "producto" }],
          },
        ],
      },
      {
        model: VentaEntrada,
        as: "ventaEntradas",
        include: [{ model: Entrada, as: "entrada" }],
      },
    ],
  };

  const hasUserFilter = Boolean(filters.nombre_usuario);
  const operacionesInclude = {
    model: Operacion,
    as: "operaciones",
    required: hasUserFilter,
    include: [
      {
        model: Usuario,
        as: "usuario",
        required: hasUserFilter,
        where: hasUserFilter ? { nombre_natural: { [Op.iLike]: `%${filters.nombre_usuario}%` } } : undefined,
      },
      { model: Cuenta, as: "cuenta" },
    ],
  };

  const formaColumnas = {
    "Efectivo CUP": "cantidad_cobrada_efectivo_cup",
    "Efectivo USD": "cantidad_cobrada_efectivo_usd",
    "Transferencia CUP": "cantidad_cobrada_transferencia_cup",
    "Transferencia USD": "cantidad_cobrada_transferencia_usd",
  };
  if (filters.forma_cobro) where[formaColumnas[filters.forma_cobro]] = { [Op.gt]: 0 };
  if (andConditions.length > 0) where[Op.and] = andConditions;

  const queryOptions = {
    where,
    include: [ventasInclude, operacionesInclude],
    order: [["fecha_hora", "DESC"]],
    distinct: true,
  };
  const { rows, count } = await ListaVenta.findAndCountAll({ ...queryOptions, limit, offset });
  const allRows = await ListaVenta.findAll(queryOptions);
  const summary = {
    total_efectivo_cup: 0,
    total_efectivo_usd: 0,
    total_transferencia_cup: 0,
    total_transferencia_usd: 0,
  };
  for (const lista of allRows) {
    summary.total_efectivo_cup += parseFloat(lista.cantidad_cobrada_efectivo_cup || 0);
    summary.total_efectivo_usd += parseFloat(lista.cantidad_cobrada_efectivo_usd || 0);
    summary.total_transferencia_cup += parseFloat(lista.cantidad_cobrada_transferencia_cup || 0);
    summary.total_transferencia_usd += parseFloat(lista.cantidad_cobrada_transferencia_usd || 0);
  }
  return { rows, count, summary };
};

// CREATE (con descuento real de entradas)
const createListaVenta = async (listaData) => {
  const {
    fecha_hora,
    nota,
    cantidad_cobrada_efectivo_cup,
    cantidad_cobrada_efectivo_usd,
    cantidad_cobrada_transferencia_cup,
    cantidad_cobrada_transferencia_usd,
    id_cuenta_efectivo_cup,
    id_cuenta_efectivo_usd,
    id_cuenta_transferencia_cup,
    id_cuenta_transferencia_usd,
    id_usuario,
    cambio_moneda,
    ventas,
  } = listaData;

  // 1. Validar usuario
  const usuario = await Usuario.findByPk(id_usuario);
  if (!usuario) throwError("Usuario no encontrado.", 404);

  // 2. Validar cuentas (si se usan)
  const cuentas = {};
  if (cantidad_cobrada_efectivo_cup > 0) {
    cuentas.efectivo_cup = await validateCuentaExists(id_cuenta_efectivo_cup, "Efectivo CUP");
  }
  if (cantidad_cobrada_efectivo_usd > 0) {
    cuentas.efectivo_usd = await validateCuentaExists(id_cuenta_efectivo_usd, "Efectivo USD");
  }
  if (cantidad_cobrada_transferencia_cup > 0) {
    cuentas.transferencia_cup = await validateCuentaExists(id_cuenta_transferencia_cup, "Transferencia CUP");
  }
  if (cantidad_cobrada_transferencia_usd > 0) {
    cuentas.transferencia_usd = await validateCuentaExists(id_cuenta_transferencia_usd, "Transferencia USD");
  }

  // 3. Validar ventas y sumar totales
  const ventasData = [];

  for (const v of ventas) {
    if (!v.id_servicio_tienda) throwError("Cada venta debe tener id_servicio_tienda.", 400);
    if (v.cantidad === undefined || v.cantidad === null || isNaN(v.cantidad) || v.cantidad <= 0) {
      throwError("La cantidad de cada venta debe ser un número mayor que cero.", 400);
    }
    if (v.precio_cobrado_cup === undefined || v.precio_cobrado_cup === null || isNaN(v.precio_cobrado_cup) || v.precio_cobrado_cup < 0) {
      throwError("precio_cobrado_cup debe ser un número no negativo.", 400);
    }
    if (v.precio_cobrado_usd === undefined || v.precio_cobrado_usd === null || isNaN(v.precio_cobrado_usd) || v.precio_cobrado_usd < 0) {
      throwError("precio_cobrado_usd debe ser un número no negativo.", 400);
    }

    const st = await validateServicioTiendaProducto(v.id_servicio_tienda, false);
    const resultadoComponentes = await resolverComponentesVenta(st, v.cantidad);
    const consumos = consolidarConsumos(resultadoComponentes.consumos);
    for (const consumo of consumos) {
      const consumoSt = await ServicioTienda.findByPk(consumo.id_servicio_tienda);
      if (!consumoSt || parseFloat(consumoSt.cantidad || 0) < consumo.cantidad) {
        throwError(`Stock insuficiente para el servicio-tienda ${consumo.id_servicio_tienda}.`, 400);
      }
    }

    const precio_original_cup = parseFloat(st.precio_cup || 0);
    const precio_original_usd = parseFloat(st.precio_usd || 0);
    const costo_original_cup = resultadoComponentes.costo_cup / v.cantidad;
    const costo_original_usd = resultadoComponentes.costo_usd / v.cantidad;

    ventasData.push({
      id_servicio_tienda: v.id_servicio_tienda,
      cantidad: v.cantidad,
      consumos,
      precio_original_cup,
      precio_original_usd,
      costo_original_cup,
      costo_original_usd,
      precio_cobrado_cup: v.precio_cobrado_cup,
      precio_cobrado_usd: v.precio_cobrado_usd,
    });

  }

  const transaction = await ListaVenta.sequelize.transaction();

  try {
    // 5.1 Crear la lista de ventas
    const nuevaLista = await ListaVenta.create(
      {
        fecha_hora,
        nota,
        cantidad_cobrada_efectivo_cup,
        cantidad_cobrada_efectivo_usd,
        cantidad_cobrada_transferencia_cup,
        cantidad_cobrada_transferencia_usd,
      },
      { transaction }
    );

    // 5.2 Crear ventas, descontar entradas y actualizar stock
    const ventasCreadas = [];
    for (const v of ventasData) {
      // Crear la venta
      const venta = await Venta.create(
        {
          id_servicio_tienda: v.id_servicio_tienda,
          id_lista_venta: nuevaLista.id_lista_venta,
          cantidad: v.cantidad,
          precio_original_cup: v.precio_original_cup,
          precio_original_usd: v.precio_original_usd,
          costo_original_cup: v.costo_original_cup,
          costo_original_usd: v.costo_original_usd,
          precio_cobrado_cup: v.precio_cobrado_cup,
          precio_cobrado_usd: v.precio_cobrado_usd,
        },
        { transaction }
      );

      await aplicarConsumosVenta(venta.id_venta, v.consumos, transaction);

      ventasCreadas.push(venta);
    }

    // 5.3 Crear operaciones por cada forma de cobro con monto > 0
    const operacionesCreadas = [];
    const tiposCobro = [
      { key: "efectivo_cup", cantidad: cantidad_cobrada_efectivo_cup, cuenta: cuentas.efectivo_cup },
      { key: "efectivo_usd", cantidad: cantidad_cobrada_efectivo_usd, cuenta: cuentas.efectivo_usd },
      { key: "transferencia_cup", cantidad: cantidad_cobrada_transferencia_cup, cuenta: cuentas.transferencia_cup },
      { key: "transferencia_usd", cantidad: cantidad_cobrada_transferencia_usd, cuenta: cuentas.transferencia_usd },
    ];

    for (const item of tiposCobro) {
      if (item.cantidad > 0) {
        const cuenta = item.cuenta;
        if (!cuenta) throwError(`Falta cuenta para ${item.key}`, 400);

        const operacion = await Operacion.create(
          {
            id_cuenta: cuenta.id_cuenta,
            id_usuario,
            id_lista_venta: nuevaLista.id_lista_venta,
            cantidad_operacion: item.cantidad,
            tipo_operacion: "Ingreso por Venta",
            fecha_hora,
            motivo: "Ingreso por Venta",
            cambio_moneda,
          },
          { transaction }
        );

        await actualizarFondoCuenta(cuenta.id_cuenta, item.cantidad, transaction);
        operacionesCreadas.push(operacion);
      }
    }

    await transaction.commit();

    return await getListaVentaWithRelations(nuevaLista.id_lista_venta);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const updateListaVenta = async (id, listaData) => {
  const transaction = await ListaVenta.sequelize.transaction();

  try {
    const lista = await ListaVenta.findByPk(id, {
      include: [
        {
          model: Venta,
          as: "ventas",
          include: [{
            model: ServicioTienda,
            as: "servicioTienda",
            include: [{ model: Servicio, as: "servicio", include: [{ model: Producto, as: "producto" }] }],
          }],
        },
        { model: Operacion, as: "operaciones" },
      ],
      transaction,
    });
    if (!lista) throwError("Lista de ventas no encontrada.", 404);

    for (const op of lista.operaciones) {
      await actualizarFondoCuenta(op.id_cuenta, -parseFloat(op.cantidad_operacion), transaction);
      await op.destroy({ transaction });
    }
    for (const venta of lista.ventas) {
      const resultadoAnterior = await resolverComponentesVenta(venta.servicioTienda, parseFloat(venta.cantidad), transaction);
      await revertirConsumosVenta(venta.id_venta, consolidarConsumos(resultadoAnterior.consumos), transaction);
      await venta.destroy({ transaction });
    }

    const {
      fecha_hora, nota, cantidad_cobrada_efectivo_cup, cantidad_cobrada_efectivo_usd,
      cantidad_cobrada_transferencia_cup, cantidad_cobrada_transferencia_usd,
      id_cuenta_efectivo_cup, id_cuenta_efectivo_usd,
      id_cuenta_transferencia_cup, id_cuenta_transferencia_usd,
      id_usuario, cambio_moneda, ventas,
    } = listaData;
    const usuario = await Usuario.findByPk(id_usuario, { transaction });
    if (!usuario) throwError("Usuario no encontrado.", 404);

    const cuentas = {};
    if (cantidad_cobrada_efectivo_cup > 0) cuentas.efectivo_cup = await validateCuentaExists(id_cuenta_efectivo_cup, "Efectivo CUP");
    if (cantidad_cobrada_efectivo_usd > 0) cuentas.efectivo_usd = await validateCuentaExists(id_cuenta_efectivo_usd, "Efectivo USD");
    if (cantidad_cobrada_transferencia_cup > 0) cuentas.transferencia_cup = await validateCuentaExists(id_cuenta_transferencia_cup, "Transferencia CUP");
    if (cantidad_cobrada_transferencia_usd > 0) cuentas.transferencia_usd = await validateCuentaExists(id_cuenta_transferencia_usd, "Transferencia USD");

    const ventasData = [];
    for (const v of ventas) {
      if (!v.id_servicio_tienda) throwError("Cada venta debe tener id_servicio_tienda.", 400);
      if (v.cantidad === undefined || v.cantidad === null || isNaN(v.cantidad) || v.cantidad <= 0) {
        throwError("La cantidad de cada venta debe ser un número mayor que cero.", 400);
      }
      if (v.precio_cobrado_cup === undefined || v.precio_cobrado_cup === null || isNaN(v.precio_cobrado_cup) || v.precio_cobrado_cup < 0) {
        throwError("precio_cobrado_cup debe ser un número no negativo.", 400);
      }
      if (v.precio_cobrado_usd === undefined || v.precio_cobrado_usd === null || isNaN(v.precio_cobrado_usd) || v.precio_cobrado_usd < 0) {
        throwError("precio_cobrado_usd debe ser un número no negativo.", 400);
      }
      const st = await validateServicioTiendaProducto(v.id_servicio_tienda, false);
      const resultadoComponentes = await resolverComponentesVenta(st, v.cantidad, transaction);
      const consumos = consolidarConsumos(resultadoComponentes.consumos);
      for (const consumo of consumos) {
        const consumoSt = await ServicioTienda.findByPk(consumo.id_servicio_tienda, { transaction });
        if (!consumoSt || parseFloat(consumoSt.cantidad || 0) < consumo.cantidad) {
          throwError(`Stock insuficiente para el servicio-tienda ${consumo.id_servicio_tienda}.`, 400);
        }
      }
      ventasData.push({
        ...v,
        consumos,
        precio_original_cup: parseFloat(st.precio_cup || 0),
        precio_original_usd: parseFloat(st.precio_usd || 0),
        costo_original_cup: resultadoComponentes.costo_cup / v.cantidad,
        costo_original_usd: resultadoComponentes.costo_usd / v.cantidad,
      });
    }

    await lista.update({
      fecha_hora, nota, cantidad_cobrada_efectivo_cup, cantidad_cobrada_efectivo_usd,
      cantidad_cobrada_transferencia_cup, cantidad_cobrada_transferencia_usd,
    }, { transaction });

    for (const v of ventasData) {
      const venta = await Venta.create({
        id_servicio_tienda: v.id_servicio_tienda,
        id_lista_venta: lista.id_lista_venta,
        cantidad: v.cantidad,
        precio_original_cup: v.precio_original_cup,
        precio_original_usd: v.precio_original_usd,
        costo_original_cup: v.costo_original_cup,
        costo_original_usd: v.costo_original_usd,
        precio_cobrado_cup: v.precio_cobrado_cup,
        precio_cobrado_usd: v.precio_cobrado_usd,
      }, { transaction });
      await aplicarConsumosVenta(venta.id_venta, v.consumos, transaction);
    }

    const tiposCobro = [
      { key: "efectivo_cup", cantidad: cantidad_cobrada_efectivo_cup, cuenta: cuentas.efectivo_cup },
      { key: "efectivo_usd", cantidad: cantidad_cobrada_efectivo_usd, cuenta: cuentas.efectivo_usd },
      { key: "transferencia_cup", cantidad: cantidad_cobrada_transferencia_cup, cuenta: cuentas.transferencia_cup },
      { key: "transferencia_usd", cantidad: cantidad_cobrada_transferencia_usd, cuenta: cuentas.transferencia_usd },
    ];
    for (const item of tiposCobro) {
      if (item.cantidad > 0) {
        if (!item.cuenta) throwError(`Falta cuenta para ${item.key}`, 400);
        await Operacion.create({
          id_cuenta: item.cuenta.id_cuenta, id_usuario, id_lista_venta: lista.id_lista_venta,
          cantidad_operacion: item.cantidad, tipo_operacion: "Ingreso por Venta", fecha_hora,
          motivo: "Ingreso por Venta", cambio_moneda,
        }, { transaction });
        await actualizarFondoCuenta(item.cuenta.id_cuenta, item.cantidad, transaction);
      }
    }

    await transaction.commit();
    return await getListaVentaWithRelations(lista.id_lista_venta);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// DELETE (revertir descuento de entradas)
const deleteListaVenta = async (id) => {
  const transaction = await ListaVenta.sequelize.transaction();

  try {
    const lista = await ListaVenta.findByPk(id, {
      include: [
        {
          model: Venta,
          as: "ventas",
          include: [{
            model: ServicioTienda,
            as: "servicioTienda",
            include: [{ model: Servicio, as: "servicio", include: [{ model: Producto, as: "producto" }] }],
          }],
        },
        { model: Operacion, as: "operaciones" },
      ],
      transaction,
    });
    if (!lista) throwError("Lista de ventas no encontrada.", 404);

    // 1. Revertir operaciones: restar fondos de cuentas y eliminar operaciones
    for (const op of lista.operaciones) {
      await actualizarFondoCuenta(op.id_cuenta, -op.cantidad_operacion, transaction);
      await op.destroy({ transaction });
    }

    // 2. Revertir ventas: devolver stock y eliminar registros intermedios
    for (const venta of lista.ventas) {
      const resultado = await resolverComponentesVenta(venta.servicioTienda, parseFloat(venta.cantidad), transaction);
      await revertirConsumosVenta(venta.id_venta, consolidarConsumos(resultado.consumos), transaction);

      // Eliminar la venta
      await venta.destroy({ transaction });
    }

    // 3. Eliminar la lista
    await lista.destroy({ transaction });

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = {
  getListaVentaById,
  filterListaVentas,
  createListaVenta,
  updateListaVenta,
  deleteListaVenta,
};