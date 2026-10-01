const { Servicio } = require("../models/servicio");
const { Producto } = require("../models/producto");
const { ServicioTienda } = require("../models/servicio_tienda");
const { Oferta } = require("../models/oferta");
const { Tienda } = require("../models/tienda");
const { Codigo } = require("../models/codigo");
const { Op } = require("sequelize");
const { throwError } = require("../helpers/errorLauncher");

const validateTiendaExists = async (id_tienda) => {
  const count = await Tienda.count({ where: { id_tienda } });
  if (count === 0) {
    throwError(`La tienda con id ${id_tienda} no existe`, 400);
  }
};

const validateServicioExists = async (id_servicio) => {
  const count = await Servicio.count({ where: { id_servicio } });
  if (count === 0) {
    throwError(`El servicio con id ${id_servicio} no existe`, 400);
  }
};

const normalizeCodigoList = (codigoList) => {
  if (codigoList === undefined) {
    return undefined;
  }
  if (!Array.isArray(codigoList) || codigoList.length === 0) {
    throwError("El servicio debe tener al menos un código relacionado", 400);
  }

  const normalized = [];
  const seen = new Set();

  for (const item of codigoList) {
    const codigoValue = item && typeof item === "object" ? item.codigo_barras_ean : item;
    const notaValue = item && typeof item === "object" ? item.nota : null;

    if (codigoValue === undefined || codigoValue === null || String(codigoValue).trim() === "") {
      throwError("Cada código debe incluir un valor válido en codigo_barras_ean", 400);
    }

    const codigoTrimmed = String(codigoValue).trim();
    if (seen.has(codigoTrimmed)) {
      throwError("No se permiten códigos duplicados en la lista", 400);
    }

    seen.add(codigoTrimmed);
    normalized.push({
      codigo_barras_ean: codigoTrimmed,
      nota: notaValue === undefined || notaValue === null ? null : String(notaValue),
    });
  }

  return normalized;
};

const validateCodigoBarrasUnico = async (codigoBarrasEan, excludeId = null) => {
  const where = { codigo_barras_ean: codigoBarrasEan };
  if (excludeId) {
    where.id_codigo = { [Op.ne]: excludeId };
  }
  const count = await Codigo.count({ where });
  if (count > 0) {
    throwError(`El código de barras "${codigoBarrasEan}" ya está en uso`, 400);
  }
};

const createServicio = async (servicioData, servicioTiendaList, ofertaList, codigoList) => {
  const transaction = await Servicio.sequelize.transaction();
  let newServicio;

  try {
    const normalizedCodigos = normalizeCodigoList(codigoList);
    for (const codigo of normalizedCodigos) {
      await validateCodigoBarrasUnico(codigo.codigo_barras_ean);
    }

    newServicio = await Servicio.create(
      {
        nombre: servicioData.nombre,
        categoria: servicioData.categoria,
        esvendible: servicioData.esvendible !== undefined ? servicioData.esvendible : true,
        nota: servicioData.nota || null,
      },
      { transaction }
    );

    if (normalizedCodigos && normalizedCodigos.length > 0) {
      const codigoData = normalizedCodigos.map((codigo) => ({
        id_servicio: newServicio.id_servicio,
        codigo_barras_ean: codigo.codigo_barras_ean,
        nota: codigo.nota,
      }));
      await Codigo.bulkCreate(codigoData, { transaction });
    }

    if (servicioTiendaList && Array.isArray(servicioTiendaList) && servicioTiendaList.length > 0) {
      const tiendaIds = servicioTiendaList.map((item) => item.id_tienda);
      const uniqueTiendaIds = new Set(tiendaIds);
      if (uniqueTiendaIds.size !== tiendaIds.length) {
        throwError("No se permiten duplicados de tienda en la lista de servicio_tienda", 400);
      }

      for (const item of servicioTiendaList) {
        if (item.precio_cup < 0 || item.precio_usd < 0 || item.costo_cup < 0 || item.costo_usd < 0) {
          throwError("Los precios y costos no pueden ser negativos", 400);
        }
        await validateTiendaExists(item.id_tienda);
      }

      const stData = servicioTiendaList.map((item) => ({
        id_servicio: newServicio.id_servicio,
        id_tienda: item.id_tienda,
        precio_cup: item.precio_cup,
        precio_usd: item.precio_usd,
        costo_cup: item.costo_cup,
        costo_usd: item.costo_usd,
      }));
      await ServicioTienda.bulkCreate(stData, { transaction });
    }

    if (ofertaList && Array.isArray(ofertaList) && ofertaList.length > 0) {
      const compIds = ofertaList.map((item) => item.id_servicio_componente);
      const uniqueCompIds = new Set(compIds);
      if (uniqueCompIds.size !== compIds.length) {
        throwError("No se permiten duplicados de servicio componente en la lista de ofertas", 400);
      }

      for (const item of ofertaList) {
        if (item.cantidad < 0) {
          throwError("La cantidad no puede ser negativa", 400);
        }
        if (item.id_servicio_componente === newServicio.id_servicio) {
          throwError("Un servicio no puede ser componente de sí mismo", 400);
        }
        await validateServicioExists(item.id_servicio_componente);
      }

      const ofertaData = ofertaList.map((item) => ({
        id_servicio_oferta: newServicio.id_servicio,
        id_servicio_componente: item.id_servicio_componente,
        cantidad: item.cantidad,
      }));
      await Oferta.bulkCreate(ofertaData, { transaction });
    }

    await transaction.commit();
    return await getServicioById(newServicio.id_servicio);
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    throw error;
  }
};

const getServicioById = async (id) => {
  const servicio = await Servicio.findByPk(id, {
    include: [
      { model: Producto, as: "producto" },
      { model: Codigo, as: "codigos" },
      {
        model: ServicioTienda,
        as: "tiendas_servicio",
        include: [{ model: Tienda, as: "tienda" }],
      },
      {
        model: Servicio,
        as: "componentes",
        through: { attributes: ["cantidad"] },
        include: [
          { model: Producto, as: "producto" },
          { model: Codigo, as: "codigos" },
          {
            model: ServicioTienda,
            as: "tiendas_servicio",
            include: [{ model: Tienda, as: "tienda" }],
          },
        ],
      },
      {
        model: Servicio,
        as: "ofertas_que_incluyen",
        through: { attributes: ["cantidad"] },
        include: [
          { model: Producto, as: "producto" },
          { model: Codigo, as: "codigos" },
          {
            model: ServicioTienda,
            as: "tiendas_servicio",
            include: [{ model: Tienda, as: "tienda" }],
          },
        ],
      },
    ],
  });

  if (!servicio) {
    throwError("Servicio no encontrado", 404);
  }
  return servicio;
};

const getServicioByCodigo = async (codigo) => {
  const codigoEncontrado = await Codigo.findOne({
    where: { codigo_barras_ean: codigo },
    raw: true,
  });

  if (!codigoEncontrado) {
    throwError(`Servicio con código "${codigo}" no encontrado`, 404);
  }

  const servicio = await Servicio.findByPk(codigoEncontrado.id_servicio, {
    include: [
      { model: Producto, as: "producto" },
      { model: Codigo, as: "codigos" },
      {
        model: ServicioTienda,
        as: "tiendas_servicio",
        include: [{ model: Tienda, as: "tienda" }],
      },
      {
        model: Servicio,
        as: "componentes",
        through: { attributes: ["cantidad"] },
        include: [
          { model: Producto, as: "producto" },
          { model: Codigo, as: "codigos" },
          {
            model: ServicioTienda,
            as: "tiendas_servicio",
            include: [{ model: Tienda, as: "tienda" }],
          },
        ],
      },
      {
        model: Servicio,
        as: "ofertas_que_incluyen",
        through: { attributes: ["cantidad"] },
        include: [
          { model: Producto, as: "producto" },
          { model: Codigo, as: "codigos" },
          {
            model: ServicioTienda,
            as: "tiendas_servicio",
            include: [{ model: Tienda, as: "tienda" }],
          },
        ],
      },
    ],
  });

  if (!servicio) {
    throwError(`Servicio con código "${codigo}" no encontrado`, 404);
  }
  return servicio;
};

// ============================================================
// filterServicios OPTIMIZADO
// - Paginación y filtrado ahora se hacen en SQL (LIMIT/OFFSET + EXISTS)
// - Se eliminaron los includes de "codigos" y "tienda" (anidado)
// - Menos round-trips: count + IDs paginados + detalle de la página
// ============================================================
const filterServicios = async (
  filterCriteria = {},
  tienda_nombre,
  id_tienda,
  includeProductos,
  conStock = false,   // parámetro de stock (solo aplica a productos)
  limit = 10,
  offset = 0
) => {
  // --- 1. Construir WHERE básico sobre la tabla servicios ---
  const whereClause = {};
  const { codigo: codigoFilter, ...serviceFilterCriteria } = filterCriteria;

  for (const [key, value] of Object.entries(serviceFilterCriteria)) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "boolean" || typeof value === "number") {
      whereClause[key] = value;
    } else {
      whereClause[key] = { [Op.iLike]: `%${value}%` };
    }
  }

  // --- 2. Resolver tiendas (una sola vez) ---
  let tiendaIds = [];
  if (id_tienda !== undefined && id_tienda !== null && id_tienda !== "") {
    const parsedIdTienda = parseInt(id_tienda, 10);
    if (isNaN(parsedIdTienda) || parsedIdTienda < 1) {
      throwError("El parámetro 'id_tienda' debe ser un número entero positivo", 400);
    }
    tiendaIds.push(parsedIdTienda);
  } else if (tienda_nombre && typeof tienda_nombre === "string" && tienda_nombre.trim()) {
    const normalizedTiendaNombre = tienda_nombre.trim();
    const tiendas = await Tienda.findAll({
      where: { nombre: { [Op.iLike]: `%${normalizedTiendaNombre}%` } },
      attributes: ["id_tienda"],
      raw: true,
    });
    tiendaIds = tiendas.map((t) => t.id_tienda);
    if (tiendaIds.length === 0) {
      return { rows: [], count: 0 };
    }
  }

  // --- 3. Construir condiciones EXISTS (filtrado lateral en SQL) ---
  const sequelizeInstance = Servicio.sequelize;
  const servicioAlias = Servicio.name;      // alias que usa Sequelize en el SQL generado
  const codigoTable   = Codigo.getTableName();
  const productTable  = Producto.getTableName();
  const stTable       = ServicioTienda.getTableName();

  const andConditions = [];

  // 3.a Filtro por código de barras (búsqueda parcial, antes se hacía con JOIN)
  if (codigoFilter !== undefined && codigoFilter !== null && codigoFilter !== "") {
    const normalizedCodigo = String(codigoFilter).trim();
    const escaped = sequelizeInstance.escape(`%${normalizedCodigo}%`);
    andConditions.push(
      sequelizeInstance.literal(
        `EXISTS (
          SELECT 1 FROM "${codigoTable}" AS "c"
          WHERE "c"."id_servicio" = "${servicioAlias}"."id_servicio"
            AND "c"."codigo_barras_ean" ILIKE ${escaped}
        )`
      )
    );
  }

  // 3.b Filtro por tienda (id o nombre ya resuelto a tiendaIds)
  if (tiendaIds.length > 0) {
    const ids = tiendaIds.join(",");
    andConditions.push(
      sequelizeInstance.literal(
        `EXISTS (
          SELECT 1 FROM "${stTable}" AS "st"
          WHERE "st"."id_servicio" = "${servicioAlias}"."id_servicio"
            AND "st"."id_tienda" IN (${ids})
        )`
      )
    );
  }

  // 3.c fetchProducto=false → excluir servicios que son productos
  if (includeProductos === false) {
    andConditions.push(
      sequelizeInstance.literal(
        `NOT EXISTS (
          SELECT 1 FROM "${productTable}" AS "p"
          WHERE "p"."id_servicio" = "${servicioAlias}"."id_servicio"
        )`
      )
    );
  }

  // 3.d conStock=true + fetchProducto=true + tienda → solo productos con stock>0
  //     (los servicios que NO son productos pasan siempre, igual que antes)
  if (includeProductos === true && conStock === true && tiendaIds.length > 0) {
    const ids = tiendaIds.join(",");
    andConditions.push(
      sequelizeInstance.literal(
        `(
          NOT EXISTS (
            SELECT 1 FROM "${productTable}" AS "p2"
            WHERE "p2"."id_servicio" = "${servicioAlias}"."id_servicio"
          )
          OR
          EXISTS (
            SELECT 1 FROM "${stTable}" AS "st2"
            WHERE "st2"."id_servicio" = "${servicioAlias}"."id_servicio"
              AND "st2"."id_tienda" IN (${ids})
              AND "st2"."cantidad" > 0
          )
        )`
      )
    );
  }

  if (andConditions.length > 0) {
    whereClause[Op.and] = andConditions;
  }

  // --- 4. COUNT en SQL (1 round-trip, sin traer filas) ---
  const count = await Servicio.count({ where: whereClause });

  if (count === 0) {
    return { rows: [], count: 0 };
  }

  // --- 5. IDs paginados en SQL (1 round-trip, solo 10 filas) ---
  //     Mantenemos el mismo orden de paginación que antes: id_servicio ASC
  const idRows = await Servicio.findAll({
    attributes: ["id_servicio"],
    where: whereClause,
    order: [["id_servicio", "ASC"]],
    limit,
    offset,
    raw: true,
  });

  const pagedIds = idRows.map((r) => r.id_servicio);

  if (pagedIds.length === 0) {
    return { rows: [], count };
  }

  // --- 6. Detalle SOLO de la página (1 round-trip) ---
  //     Includes: producto, tiendas_servicio (sin tienda anidada), componentes
  //     y ofertas_que_incluyen (con producto y tiendas_servicio).
  //     Se eliminaron "codigos" y "tienda".
  const includeList = [
    { model: Producto, as: "producto" },
    {
      model: ServicioTienda,
      as: "tiendas_servicio",
    },
    {
      model: Servicio,
      as: "componentes",
      through: { attributes: ["cantidad"] },
      include: [
        { model: Producto, as: "producto" },
        { model: ServicioTienda, as: "tiendas_servicio" },
      ],
    },
    {
      model: Servicio,
      as: "ofertas_que_incluyen",
      through: { attributes: ["cantidad"] },
      include: [
        { model: Producto, as: "producto" },
        { model: ServicioTienda, as: "tiendas_servicio" },
      ],
    },
  ];

  const rows = await Servicio.findAll({
    where: { id_servicio: { [Op.in]: pagedIds } },
    order: [["createdAt", "DESC"]],
    include: includeList,
  });

  return {
    rows,
    count,
  };
};

const updateServicio = async (id, servicioData, servicioTiendaList, ofertaList, codigoList) => {
  const transaction = await Servicio.sequelize.transaction();

  try {
    const servicio = await Servicio.findByPk(id, { transaction });
    if (!servicio) {
      throwError("Servicio no encontrado", 404);
    }

    await servicio.update(
      {
        nombre: servicioData.nombre !== undefined ? servicioData.nombre : servicio.nombre,
        categoria: servicioData.categoria !== undefined ? servicioData.categoria : servicio.categoria,
        esvendible: servicioData.esvendible !== undefined ? servicioData.esvendible : servicio.esvendible,
        nota: servicioData.nota !== undefined ? servicioData.nota : servicio.nota,
      },
      { transaction }
    );

    if (codigoList !== undefined) {
      const normalizedCodigos = normalizeCodigoList(codigoList);
      const existingCodes = await Codigo.findAll({ where: { id_servicio: id }, transaction });
      const existingCodesSet = new Set(existingCodes.map((item) => item.codigo_barras_ean));

      for (const codigo of normalizedCodigos) {
        if (!existingCodesSet.has(codigo.codigo_barras_ean)) {
          await validateCodigoBarrasUnico(codigo.codigo_barras_ean);
        }
      }

      await Codigo.destroy({ where: { id_servicio: id }, transaction });
      if (normalizedCodigos.length > 0) {
        await Codigo.bulkCreate(
          normalizedCodigos.map((codigo) => ({
            id_servicio: id,
            codigo_barras_ean: codigo.codigo_barras_ean,
            nota: codigo.nota,
          })),
          { transaction }
        );
      }
    }

    if (servicioTiendaList !== undefined) {
      await ServicioTienda.destroy({
        where: { id_servicio: id },
        transaction,
      });

      if (Array.isArray(servicioTiendaList) && servicioTiendaList.length > 0) {
        const tiendaIds = servicioTiendaList.map((item) => item.id_tienda);
        const uniqueTiendaIds = new Set(tiendaIds);
        if (uniqueTiendaIds.size !== tiendaIds.length) {
          throwError("No se permiten duplicados de tienda en la lista de servicio_tienda", 400);
        }

        for (const item of servicioTiendaList) {
          if (item.precio_cup < 0 || item.precio_usd < 0 || item.costo_cup < 0 || item.costo_usd < 0) {
            throwError("Los precios y costos no pueden ser negativos", 400);
          }
          await validateTiendaExists(item.id_tienda);
        }

        const stData = servicioTiendaList.map((item) => ({
          id_servicio: id,
          id_tienda: item.id_tienda,
          precio_cup: item.precio_cup,
          precio_usd: item.precio_usd,
          costo_cup: item.costo_cup,
          costo_usd: item.costo_usd,
        }));
        await ServicioTienda.bulkCreate(stData, { transaction });
      }
    }

    if (ofertaList !== undefined) {
      await Oferta.destroy({
        where: { id_servicio_oferta: id },
        transaction,
      });

      if (Array.isArray(ofertaList) && ofertaList.length > 0) {
        const compIds = ofertaList.map((item) => item.id_servicio_componente);
        const uniqueCompIds = new Set(compIds);
        if (uniqueCompIds.size !== compIds.length) {
          throwError("No se permiten duplicados de servicio componente en la lista de ofertas", 400);
        }

        for (const item of ofertaList) {
          if (item.cantidad < 0) {
            throwError("La cantidad no puede ser negativa", 400);
          }
          if (item.id_servicio_componente === parseInt(id, 10)) {
            throwError("Un servicio no puede ser componente de sí mismo", 400);
          }
          await validateServicioExists(item.id_servicio_componente);
        }

        const ofertaData = ofertaList.map((item) => ({
          id_servicio_oferta: id,
          id_servicio_componente: item.id_servicio_componente,
          cantidad: item.cantidad,
        }));
        await Oferta.bulkCreate(ofertaData, { transaction });
      }
    }

    await transaction.commit();
    return await getServicioById(id);
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    throw error;
  }
};

const deleteServicio = async (id) => {
  const transaction = await Servicio.sequelize.transaction();

  try {
    // 1. Verificar que el servicio existe
    const servicio = await Servicio.findByPk(id, { transaction });
    if (!servicio) {
      throwError("Servicio no encontrado", 404);
    }

    // 2. Eliminar todas las filas relacionadas
    //    (aunque las claves foráneas tengan ON DELETE CASCADE,
    //     hacemos la eliminación explícita para mayor control y claridad)

    // Eliminar códigos de barras asociados
    await Codigo.destroy({
      where: { id_servicio: id },
      transaction,
    });

    // Eliminar producto asociado (si existe)
    await Producto.destroy({
      where: { id_servicio: id },
      transaction,
    });

    // Eliminar relaciones con tiendas (servicio_tienda)
    await ServicioTienda.destroy({
      where: { id_servicio: id },
      transaction,
    });

    // Eliminar ofertas donde este servicio es el padre (id_servicio_oferta)
    await Oferta.destroy({
      where: { id_servicio_oferta: id },
      transaction,
    });

    // Eliminar ofertas donde este servicio es un componente (id_servicio_componente)
    await Oferta.destroy({
      where: { id_servicio_componente: id },
      transaction,
    });

    // 3. Finalmente, eliminar el servicio principal
    await servicio.destroy({ transaction });

    // 4. Confirmar transacción
    await transaction.commit();

    return { id_servicio: id, eliminado: true };
  } catch (error) {
    // Revertir en caso de error
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    throw error;
  }
};

module.exports = {
  createServicio,
  getServicioById,
  getServicioByCodigo,
  filterServicios,
  updateServicio,
  deleteServicio,
};