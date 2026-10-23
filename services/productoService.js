const { Servicio } = require("../models/servicio");
const { Producto } = require("../models/producto");
const { ServicioTienda } = require("../models/servicio_tienda");
const { Tienda } = require("../models/tienda");
const { Codigo } = require("../models/codigo");
const { Entrada } = require("../models/entrada");
const { Salida } = require("../models/salida");
const { Venta } = require("../models/venta");
const { ListaVenta } = require("../models/lista_venta");
const { Movimiento } = require("../models/movimiento");
const { MovimientoLista } = require("../models/movimiento_lista");
const { Op, Sequelize } = require("sequelize");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { throwError } = require("../helpers/errorLauncher");

// Directorio donde se guardarán las imágenes
const IMAGE_UPLOAD_DIR = path.join(__dirname, "..", "imagenes_productos");

// Asegurar que el directorio existe
const ensureImageUploadDir = () => {
  if (!fs.existsSync(IMAGE_UPLOAD_DIR)) {
    fs.mkdirSync(IMAGE_UPLOAD_DIR, { recursive: true });
  }
};

// Detectar si es una URL remota
const isRemoteImage = (value) => /^https?:\/\//i.test(value);

const detectImageExtension = (buffer) => {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer.subarray(0, 6).toString("ascii").match(/^GIF8[79]a$/)) return "gif";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  if (buffer.subarray(0, 2).toString("ascii") === "BM") return "bmp";
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp" && ["avif", "avis"].includes(buffer.subarray(8, 12).toString("ascii"))) return "avif";

  throwError("El contenido no corresponde a una imagen PNG, JPEG, GIF, WebP, BMP o AVIF válida", 400);
};

const removeProductImageFiles = (productId, exceptFileName = null) => {
  if (!fs.existsSync(IMAGE_UPLOAD_DIR)) return;

  const legacyPrefix = `${productId}.`;
  const hashedPrefix = `${productId}-`;
  for (const fileName of fs.readdirSync(IMAGE_UPLOAD_DIR)) {
    const isLegacyImage = fileName.startsWith(legacyPrefix) && /^[a-z0-9]+$/i.test(fileName.slice(legacyPrefix.length));
    const isHashedImage = fileName.startsWith(hashedPrefix) && /^[a-f0-9]{64}\.[a-z0-9]+$/i.test(fileName.slice(hashedPrefix.length));
    if (fileName !== exceptFileName && (isLegacyImage || isHashedImage)) {
      fs.unlinkSync(path.join(IMAGE_UPLOAD_DIR, fileName));
    }
  }
};

// Parsear imagen base64 o URL
const parseBase64Image = (imagen) => {
  const trimmed = imagen.trim();
  if (!trimmed) {
    return null;
  }

  if (isRemoteImage(trimmed)) {
    return { kind: "url", value: trimmed };
  }

  let base64 = trimmed;
  if (trimmed.startsWith("data:")) {
    const matches = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i);
    if (!matches) {
      throwError("La imagen base64 es inválida", 400);
    }
    base64 = matches[2];
  }

  const normalizedBase64 = base64.replace(/\s/g, "");
  if (!normalizedBase64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalizedBase64) || normalizedBase64.length % 4 === 1) {
    throwError("La imagen base64 es inválida", 400);
  }

  const buffer = Buffer.from(normalizedBase64, "base64");
  if (!buffer || buffer.length === 0) {
    throwError("La imagen base64 es inválida", 400);
  }

  if (buffer.length > 10 * 1024 * 1024) {
    throwError("La imagen no puede superar 10 MB", 400);
  }

  return { kind: "file", buffer, extension: detectImageExtension(buffer) };
};

// Persistir imagen: guarda en disco y devuelve ruta relativa
const persistProductImage = async (imagen, productId, createdImagePaths = []) => {
  if (imagen === undefined || imagen === null) {
    return null;
  }

  if (typeof imagen !== "string") {
    throwError("La imagen debe ser un texto", 400);
  }

  const trimmed = imagen.trim();
  if (trimmed === "") {
    return null;
  }

  const parsedImage = parseBase64Image(trimmed);
  if (!parsedImage) {
    return null;
  }

  if (parsedImage.kind === "url") {
    return parsedImage.value;
  }

  ensureImageUploadDir();
  const digest = crypto.createHash("sha256").update(parsedImage.buffer).digest("hex");
  const fileName = `${productId}-${digest}.${parsedImage.extension}`;
  const filePath = path.join(IMAGE_UPLOAD_DIR, fileName);
  const tempPath = path.join(IMAGE_UPLOAD_DIR, `${productId}-${crypto.randomBytes(8).toString("hex")}.tmp`);
  const existedBefore = fs.existsSync(filePath);

  fs.writeFileSync(tempPath, parsedImage.buffer);
  fs.renameSync(tempPath, filePath);
  createdImagePaths.push({ filePath, existedBefore });

  return `/imagenes_productos/${fileName}`;
};

// Limpiar archivos creados en caso de error
const cleanupCreatedImages = (createdImagePaths = []) => {
  createdImagePaths.forEach(({ filePath, existedBefore }) => {
    if (!existedBefore && filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });
};

// Validar que la tienda exista
const validateTiendaExists = async (id_tienda) => {
  const count = await Tienda.count({ where: { id_tienda } });
  if (count === 0) {
    throwError(`La tienda con id ${id_tienda} no existe`, 400);
  }
};

// Validar sufijo único
const validateSufijoUnico = async (sufijo, excludeId = null) => {
  const where = { sufijo };
  if (excludeId) {
    where.id_servicio = { [Op.ne]: excludeId };
  }
  const count = await Producto.count({ where });
  if (count > 0) {
    throwError(`El sufijo "${sufijo}" ya está en uso`, 400);
  }
};

// Normalizar lista de códigos
const normalizeCodigoList = (codigoList) => {
  if (codigoList === undefined) {
    return undefined;
  }
  if (!Array.isArray(codigoList) || codigoList.length === 0) {
    throwError("El producto debe tener al menos un código relacionado", 400);
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

// Validar código de barras único
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

// ------ FUNCIONES PRINCIPALES DEL SERVICIO ------

const createProducto = async (productoData, productoTiendaList, codigoList) => {
  const transaction = await Servicio.sequelize.transaction();
  let newServicio;
  const createdImagePaths = [];

  try {
    const normalizedCodigos = normalizeCodigoList(codigoList);
    for (const codigo of normalizedCodigos) {
      await validateCodigoBarrasUnico(codigo.codigo_barras_ean);
    }
    await validateSufijoUnico(productoData.sufijo);

    newServicio = await Servicio.create(
      {
        nombre: productoData.nombre,
        categoria: productoData.categoria,
        esvendible: productoData.esvendible !== undefined ? productoData.esvendible : true,
        nota: productoData.nota || null,
      },
      { transaction }
    );

    const imagenUrl = await persistProductImage(productoData.imagen, newServicio.id_servicio, createdImagePaths);

    await Producto.create(
      {
        id_servicio: newServicio.id_servicio,
        imagen: imagenUrl || null,
        sufijo: productoData.sufijo,
        isVencible: productoData.isVencible !== undefined ? productoData.isVencible : false,
        unidad_medida: productoData.unidad_medida || null,
      },
      { transaction }
    );

    if (normalizedCodigos && normalizedCodigos.length > 0) {
      await Codigo.bulkCreate(
        normalizedCodigos.map((codigo) => ({
          id_servicio: newServicio.id_servicio,
          codigo_barras_ean: codigo.codigo_barras_ean,
          nota: codigo.nota,
        })),
        { transaction }
      );
    }

    if (productoTiendaList && Array.isArray(productoTiendaList) && productoTiendaList.length > 0) {
      const tiendaIds = productoTiendaList.map((item) => item.id_tienda);
      const uniqueTiendaIds = new Set(tiendaIds);
      if (uniqueTiendaIds.size !== tiendaIds.length) {
        throwError("No se permiten duplicados de tienda en la lista de producto_tienda", 400);
      }

      for (const item of productoTiendaList) {
        if (item.precio_cup < 0 || item.precio_usd < 0 || item.costo_cup < 0 || item.costo_usd < 0) {
          throwError("Los precios y costos no pueden ser negativos", 400);
        }
        if (item.cantidad !== undefined && item.cantidad !== null) {
          throwError("La cantidad no se puede modificar por este endpoint", 400);
        }
        await validateTiendaExists(item.id_tienda);
      }

      const stData = productoTiendaList.map((item) => ({
        id_servicio: newServicio.id_servicio,
        id_tienda: item.id_tienda,
        precio_cup: item.precio_cup,
        precio_usd: item.precio_usd,
        costo_cup: item.costo_cup,
        costo_usd: item.costo_usd,
        cantidad: 0,
        cantidad_alerta: item.cantidad_alerta || null,
      }));
      await ServicioTienda.bulkCreate(stData, { transaction });
    }

    await transaction.commit();
    return await getProductoById(newServicio.id_servicio);
  } catch (error) {
    if (transaction && !transaction.finished) {
      cleanupCreatedImages(createdImagePaths);
      await transaction.rollback();
    }
    throw error;
  }
};

const getProductoById = async (id) => {
  const servicio = await Servicio.findByPk(id, {
    include: [
      { model: Producto, as: "producto" },
      { model: Codigo, as: "codigos" },
      {
        model: ServicioTienda,
        as: "tiendas_servicio",
        include: [{ model: Tienda, as: "tienda" }],
      },
    ],
  });

  if (!servicio) {
    throwError("Producto no encontrado", 404);
  }

  const isProduct = Boolean(servicio.producto);
  if (!isProduct) {
    throwError("Producto no encontrado", 404);
  }

  return servicio;
};

const getProductosEnAlerta = async (id_tienda) => {
  const tiendaWhere = {
    [Op.and]: [
      { cantidad: { [Op.ne]: null } },
      { cantidad: { [Op.ne]: 0 } },
      Sequelize.where(
        Sequelize.col("cantidad"),
        "<=",
        Sequelize.col("cantidad_alerta")
      ),
    ],
  };

  if (id_tienda !== undefined && id_tienda !== null && id_tienda !== "") {
    const parsedIdTienda = parseInt(id_tienda, 10);
    if (isNaN(parsedIdTienda) || parsedIdTienda < 1) {
      throwError("El parámetro 'id_tienda' debe ser un número entero positivo", 400);
    }
    tiendaWhere.id_tienda = parsedIdTienda;
  }

  const matchingRows = await ServicioTienda.findAll({
    attributes: ["id_servicio"],
    where: tiendaWhere,
    group: ["id_servicio"],
    raw: true,
  });

  const matchedIds = matchingRows.map((item) => item.id_servicio);
  if (matchedIds.length === 0) {
    return [];
  }

  return await Servicio.findAll({
    where: { id_servicio: { [Op.in]: matchedIds } },
    order: [["id_servicio", "ASC"]],
    include: [
      { model: Producto, as: "producto", required: true },
      { model: Codigo, as: "codigos" },
      {
        model: ServicioTienda,
        as: "tiendas_servicio",
        include: [{ model: Tienda, as: "tienda" }],
      },
    ],
  });
};

const filterProductos = async (filterCriteria = {}, id_tienda, cantidadMin, cantidadMax, limit = 10, offset = 0) => {
  const { codigo: codigoFilter, ...serviceFilterCriteria } = filterCriteria;
  const whereClause = {};

  for (const [key, value] of Object.entries(serviceFilterCriteria)) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "boolean" || typeof value === "number") {
      whereClause[key] = value;
    } else {
      whereClause[key] = { [Op.iLike]: `%${value}%` };
    }
  }

  const matchingIdsOptions = {
    attributes: ["id_servicio"],
    where: whereClause,
    order: [["nombre", "ASC"], ["id_servicio", "ASC"]],
    distinct: true,
    raw: true,
    include: [{ model: Producto, as: "producto", required: true }],
  };

  const matchingIncludes = [];
  if (codigoFilter !== undefined && codigoFilter !== null && codigoFilter !== "") {
    const normalizedCodigo = String(codigoFilter).trim();
    matchingIncludes.push({
      model: Codigo,
      as: "codigos",
      required: true,
      where: { codigo_barras_ean: { [Op.iLike]: `%${normalizedCodigo}%` } },
    });
  }

  if (id_tienda !== undefined && id_tienda !== null && id_tienda !== "") {
    const parsedIdTienda = parseInt(id_tienda, 10);
    if (isNaN(parsedIdTienda) || parsedIdTienda < 1) {
      throwError("El parámetro 'id_tienda' debe ser un número entero positivo", 400);
    }

    matchingIncludes.push({
      model: ServicioTienda,
      as: "tiendas_servicio",
      required: true,
      where: { id_tienda: parsedIdTienda },
    });
  } else if (cantidadMin !== undefined || cantidadMax !== undefined) {
    matchingIncludes.push({
      model: ServicioTienda,
      as: "tiendas_servicio",
      required: true,
    });
  }

  if (matchingIncludes.length > 0) {
    matchingIdsOptions.include = matchingIdsOptions.include.concat(matchingIncludes);
  }

  const matchingServicios = await Servicio.findAll(matchingIdsOptions);
  const matchedIds = matchingServicios.map((item) => item.id_servicio);

  if (matchedIds.length === 0) {
    return { rows: [], count: 0 };
  }

  let filteredIds = matchedIds;
  if (cantidadMin !== undefined || cantidadMax !== undefined) {
    const cantidadWhere = { id_servicio: { [Op.in]: matchedIds } };
    if (id_tienda !== undefined && id_tienda !== null && id_tienda !== "") {
      cantidadWhere.id_tienda = parseInt(id_tienda, 10);
    }

    const productosConCantidad = await ServicioTienda.findAll({
      attributes: [
        "id_servicio",
        [Sequelize.fn("SUM", Sequelize.cast(Sequelize.col("cantidad"), "float")), "totalCantidad"],
      ],
      where: cantidadWhere,
      group: ["id_servicio"],
      raw: true,
    });

    const idsConCantidadEnRango = new Set(productosConCantidad
      .filter((item) => {
        const total = Number(item.totalCantidad || 0);
        const minOk = cantidadMin === undefined || total >= Number(cantidadMin);
        const maxOk = cantidadMax === undefined || total <= Number(cantidadMax);
        return minOk && maxOk;
      })
      .map((item) => item.id_servicio));
    filteredIds = matchedIds.filter((id) => idsConCantidadEnRango.has(id));
  }

  if (filteredIds.length === 0) {
    return { rows: [], count: 0 };
  }

  const pagedIds = filteredIds.slice(offset, offset + limit);
  const rows = pagedIds.length > 0
    ? await Servicio.findAll({
        where: { id_servicio: { [Op.in]: pagedIds } },
        order: [["nombre", "ASC"], ["id_servicio", "ASC"]],
        include: [
          { model: Producto, as: "producto" },
          { model: Codigo, as: "codigos" },
          {
            model: ServicioTienda,
            as: "tiendas_servicio",
            include: [{ model: Tienda, as: "tienda" }],
          },
        ],
      })
    : [];

  return {
    rows,
    count: filteredIds.length,
  };
};

const updateProducto = async (id, productoData, productoTiendaList, codigoList) => {
  const transaction = await Servicio.sequelize.transaction();
  const createdImagePaths = [];

  try {
    const servicio = await Servicio.findByPk(id, { transaction });
    if (!servicio) {
      throwError("Producto no encontrado", 404);
    }

    const producto = await Producto.findByPk(id, { transaction });
    if (!producto) {
      throwError("Producto no encontrado", 404);
    }

    if (productoData.sufijo && productoData.sufijo !== producto.sufijo) {
      await validateSufijoUnico(productoData.sufijo, id);
    }

    await servicio.update(
      {
        nombre: productoData.nombre !== undefined ? productoData.nombre : servicio.nombre,
        categoria: productoData.categoria !== undefined ? productoData.categoria : servicio.categoria,
        esvendible: productoData.esvendible !== undefined ? productoData.esvendible : servicio.esvendible,
        nota: productoData.nota !== undefined ? productoData.nota : servicio.nota,
      },
      { transaction }
    );

    let imagenValue = producto.imagen;
    let removeOldImages = false;
    if (productoData.imagen !== undefined) {
      if (productoData.imagen === null || productoData.imagen === "") {
        imagenValue = null;
        removeOldImages = true;
      } else {
        imagenValue = await persistProductImage(productoData.imagen, id, createdImagePaths);
        removeOldImages = true;
      }
    }

    await producto.update(
      {
        imagen: imagenValue,
        sufijo: productoData.sufijo !== undefined ? productoData.sufijo : producto.sufijo,
        isVencible: productoData.isVencible !== undefined ? productoData.isVencible : producto.isVencible,
        unidad_medida: productoData.unidad_medida !== undefined ? productoData.unidad_medida : producto.unidad_medida,
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

    // Actualizar lista de servicio_tienda (inteligente)
    if (productoTiendaList !== undefined) {
      const currentST = await ServicioTienda.findAll({
        where: { id_servicio: id },
        transaction,
      });

      const currentMap = new Map();
      currentST.forEach((st) => {
        currentMap.set(st.id_tienda, st);
      });

      const newTiendaIds = new Set();
      const newSTData = [];

      for (const item of productoTiendaList) {
        if (item.precio_cup < 0 || item.precio_usd < 0 || item.costo_cup < 0 || item.costo_usd < 0) {
          throwError("Los precios y costos no pueden ser negativos", 400);
        }
        if (item.cantidad !== undefined && item.cantidad !== null) {
          throwError("La cantidad no se puede modificar por este endpoint", 400);
        }
        await validateTiendaExists(item.id_tienda);

        newTiendaIds.add(item.id_tienda);
        newSTData.push({
          id_servicio: id,
          id_tienda: item.id_tienda,
          precio_cup: item.precio_cup,
          precio_usd: item.precio_usd,
          costo_cup: item.costo_cup,
          costo_usd: item.costo_usd,
          cantidad: 0,
          cantidad_alerta: item.cantidad_alerta || null,
        });
      }

      const toDelete = [];
      const toUpdate = [];

      for (const [tiendaId, st] of currentMap) {
        if (newTiendaIds.has(tiendaId)) {
          const newItem = newSTData.find((item) => item.id_tienda === tiendaId);
          toUpdate.push({ st, newData: newItem });
        } else {
          toDelete.push(st);
        }
      }

      if (toDelete.length > 0) {
        const stIdsToDelete = toDelete.map((st) => st.id_servicio_tienda);

        const entradaCounts = await Entrada.count({
          where: { id_servicio_tienda: { [Op.in]: stIdsToDelete } },
          transaction,
        });

        let salidaCounts = 0;
        try {
          salidaCounts = await Salida.count({
            where: { id_servicio_tienda: { [Op.in]: stIdsToDelete } },
            transaction,
          });
        } catch (e) {}

        if (entradaCounts > 0 || salidaCounts > 0) {
          const tiendasConDependencias = [];
          for (const st of toDelete) {
            const hasEntrada = await Entrada.count({
              where: { id_servicio_tienda: st.id_servicio_tienda },
              transaction,
            });
            if (hasEntrada > 0) {
              tiendasConDependencias.push(st.id_tienda);
            }
          }
          throwError(
            `No se pueden eliminar las tiendas con IDs ${tiendasConDependencias.join(", ")} porque tienen entradas asociadas. Elimine las entradas primero o mantenga estas tiendas en la lista.`,
            400
          );
        }

        for (const st of toDelete) {
          await st.destroy({ transaction });
        }
      }

      for (const { st, newData } of toUpdate) {
        await st.update(
          {
            precio_cup: newData.precio_cup,
            precio_usd: newData.precio_usd,
            costo_cup: newData.costo_cup,
            costo_usd: newData.costo_usd,
            cantidad_alerta: newData.cantidad_alerta,
          },
          { transaction }
        );
      }

      const toCreate = newSTData.filter((item) => !currentMap.has(item.id_tienda));
      if (toCreate.length > 0) {
        await ServicioTienda.bulkCreate(toCreate, { transaction });
      }
    }

    await transaction.commit();
    if (removeOldImages) {
      const currentFileName = typeof imagenValue === "string" && imagenValue.startsWith("/imagenes_productos/")
        ? path.basename(imagenValue)
        : null;
      removeProductImageFiles(id, currentFileName);
    }
    return await getProductoById(id);
  } catch (error) {
    if (transaction && !transaction.finished) {
      cleanupCreatedImages(createdImagePaths);
      await transaction.rollback();
    }
    throw error;
  }
};

/** NUEVO: Eliminar producto con validación de dependencias */
const deleteProducto = async (id) => {
  const transaction = await Servicio.sequelize.transaction();

  try {
    // 1. Verificar que el producto exista
    const servicio = await Servicio.findByPk(id, { transaction });
    if (!servicio) {
      throwError("Producto no encontrado", 404);
    }

    const producto = await Producto.findByPk(id, { transaction });
    if (!producto) {
      throwError("Producto no encontrado", 404);
    }

    // 2. Obtener todos los servicio_tienda asociados a este producto
    const servicioTiendas = await ServicioTienda.findAll({
      where: { id_servicio: id },
      transaction,
    });

    if (servicioTiendas.length > 0) {
      const stIds = servicioTiendas.map(st => st.id_servicio_tienda);

      // 3. Verificar si alguna de estas servicio_tienda tiene entradas
      const entradasCount = await Entrada.count({
        where: { id_servicio_tienda: { [Op.in]: stIds } },
        transaction,
      });

      // 4. Verificar si alguna tiene salidas
      let salidasCount = 0;
      try {
        salidasCount = await Salida.count({
          where: { id_servicio_tienda: { [Op.in]: stIds } },
          transaction,
        });
      } catch (e) {
        // Si el modelo Salida no existe, ignorar
      }

      if (entradasCount > 0 || salidasCount > 0) {
        throwError(
          `No se puede eliminar el producto porque tiene ${entradasCount > 0 ? 'entradas' : ''}${entradasCount > 0 && salidasCount > 0 ? ' y ' : ''}${salidasCount > 0 ? 'salidas' : ''} asociadas. Elimine primero las operaciones relacionadas.`,
          400
        );
      }
    }

    // 5. Si no hay dependencias, eliminar el Servicio (CASCADE eliminará Producto, Códigos y ServicioTienda)
    await servicio.destroy({ transaction });

    // 6. (Opcional) Eliminar archivo de imagen si existe
    await transaction.commit();
    removeProductImageFiles(id);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Devuelve el seguimiento del inventario de un producto (id_servicio) en una tienda
 * (id_tienda) en el rango [fecha_desde, fecha_hasta], agrupando movimientos
 * consecutivos del mismo tipo de efecto sobre el stock.
 *
 * Tipos considerados:
 *  - entrada     → suma stock  (Entrada)
 *  - salida      → resta stock (Salida, con motivo)
 *  - venta       → resta stock (Venta vía ListaVenta.fecha_hora)
 *  - movimiento  → transferencia entre tiendas (Movimiento vía MovimientoLista.fecha_hora)
 *                  subtipo "entrada" si la tienda evaluada es destino,
 *                  subtipo "salida"  si es origen.
 */
const getSeguimientoInventario = async (id_servicio, id_tienda, fecha_desde, fecha_hasta) => {
  // 1) Verificar que sea un producto (herencia Servicio → Producto)
  const producto = await Producto.findByPk(id_servicio, {
    include: [{ model: Servicio, as: "servicio" }],
  });
  if (!producto || !producto.servicio) {
    throwError("El servicio especificado no es un producto", 404);
  }

  // 2) Verificar la tienda
  const tienda = await Tienda.findByPk(id_tienda);
  if (!tienda) {
    throwError(`La tienda con id ${id_tienda} no existe`, 404);
  }

  // 3) Verificar que el producto esté asociado a la tienda
  const st = await ServicioTienda.findOne({
    where: { id_servicio, id_tienda },
  });
  if (!st) {
    throwError("El producto no está asociado a la tienda especificada", 404);
  }

  // 4) Validar fechas
  const desde = new Date(fecha_desde);
  const hasta = new Date(fecha_hasta);
  if (isNaN(desde.getTime())) {
    throwError("'fecha_desde' no es una fecha válida", 400);
  }
  if (isNaN(hasta.getTime())) {
    throwError("'fecha_hasta' no es una fecha válida", 400);
  }
  if (desde > hasta) {
    throwError("'fecha_desde' no puede ser mayor que 'fecha_hasta'", 400);
  }

  // Si fecha_hasta viene como YYYY-MM-DD, incluir todo el día
  const hastaFilter = new Date(hasta);
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(fecha_hasta).trim())) {
    hastaFilter.setHours(23, 59, 59, 999);
  }

  const fechaFilter = { [Op.between]: [desde, hastaFilter] };

  // 5) Entradas
  const entradas = await Entrada.findAll({
    where: { id_servicio_tienda: st.id_servicio_tienda, fecha: fechaFilter },
    order: [["fecha", "ASC"]],
  });

  // 6) Salidas
  const salidas = await Salida.findAll({
    where: { id_servicio_tienda: st.id_servicio_tienda, fecha: fechaFilter },
    order: [["fecha", "ASC"]],
  });

  // 7) Ventas (la fecha viene de ListaVenta.fecha_hora)
  const ventas = await Venta.findAll({
    where: { id_servicio_tienda: st.id_servicio_tienda },
    include: [
      {
        model: ListaVenta,
        as: "listaVenta",
        required: true,
        where: { fecha_hora: fechaFilter },
      },
    ],
    order: [[{ model: ListaVenta, as: "listaVenta" }, "fecha_hora", "ASC"]],
  });

  // 8) Movimientos entre tiendas (filtrados por id_servicio y por origen/destino)
  const movimientos = await Movimiento.findAll({
    where: {
      id_servicio,
      [Op.or]: [
        { id_tienda_origen: id_tienda },
        { id_tienda_destino: id_tienda },
      ],
    },
    include: [
      {
        model: MovimientoLista,
        as: "movimientoLista",
        required: true,
        where: { fecha_hora: fechaFilter },
      },
      { model: Tienda, as: "tiendaOrigen" },
      { model: Tienda, as: "tiendaDestino" },
    ],
    order: [[{ model: MovimientoLista, as: "movimientoLista" }, "fecha_hora", "ASC"]],
  });

  // 9) Normalizar todos los eventos en una lista homogénea
  const eventos = [];

  for (const e of entradas) {
    eventos.push({
      fecha: new Date(e.fecha),
      tipo: "entrada",
      cantidad: Number(e.cantidad_entrada),
      delta: Number(e.cantidad_entrada),
      detalle: {
        codigo_lote: e.codigo_lote,
        nombre_proveedor: e.nombre_proveedor,
        fecha_vencimiento: e.fecha_vencimiento,
      },
    });
  }

  for (const s of salidas) {
    eventos.push({
      fecha: new Date(s.fecha),
      tipo: "salida",
      cantidad: Number(s.cantidad_total),
      delta: -Number(s.cantidad_total),
      detalle: {
        motivo: s.descripcion,
        tipo_salida: s.tipo_salida,
      },
    });
  }

  for (const v of ventas) {
    eventos.push({
      fecha: new Date(v.listaVenta.fecha_hora),
      tipo: "venta",
      cantidad: Number(v.cantidad),
      delta: -Number(v.cantidad),
      detalle: {
        id_venta: v.id_venta,
        id_lista_venta: v.id_lista_venta,
      },
    });
  }

  for (const m of movimientos) {
    const esDestino = m.id_tienda_destino === id_tienda;
    const cantidad = Number(m.cantidad);
    eventos.push({
      fecha: new Date(m.movimientoLista.fecha_hora),
      tipo: "movimiento",
      subtipo: esDestino ? "entrada" : "salida",
      cantidad,
      delta: esDestino ? cantidad : -cantidad,
      detalle: {
        direccion: esDestino ? "entrada" : "salida",
        id_tienda_origen: m.id_tienda_origen,
        id_tienda_destino: m.id_tienda_destino,
        tienda_origen: m.tiendaOrigen ? m.tiendaOrigen.nombre : null,
        tienda_destino: m.tiendaDestino ? m.tiendaDestino.nombre : null,
        tipo_movimiento: m.movimientoLista.tipo_movimiento,
        nota: m.nota,
      },
    });
  }

  // 10) Ordenar cronológicamente
  eventos.sort((a, b) => a.fecha - b.fecha);

  // 11) Agrupar consecutivos del mismo tipo (movimiento se distingue por dirección)
  const grupos = [];
  let actual = null;

  for (const ev of eventos) {
    const key = ev.tipo === "movimiento" ? `movimiento:${ev.subtipo}` : ev.tipo;
    if (actual && actual._key === key) {
      actual.fecha_fin = ev.fecha;
      actual.cantidad_total += Math.abs(ev.cantidad);
      actual.efecto_numerico += ev.delta;
      actual.cantidad_registros += 1;
      actual._eventos.push(ev);
    } else {
      actual = {
        _key: key,
        tipo: ev.tipo,
        subtipo: ev.subtipo || null,
        fecha_inicio: ev.fecha,
        fecha_fin: ev.fecha,
        cantidad_total: Math.abs(ev.cantidad),
        efecto_numerico: ev.delta,
        cantidad_registros: 1,
        _eventos: [ev],
      };
      grupos.push(actual);
    }
  }

  // 12) Dar formato final a cada grupo
  const seguimiento = grupos.map((g, idx) => {
    const item = {
      orden: idx + 1,
      tipo: g.tipo,
      subtipo: g.subtipo,
      fecha_inicio: g.fecha_inicio,
      fecha_fin: g.fecha_fin,
      cantidad_total: g.cantidad_total,
      efecto_numerico: g.efecto_numerico,
      cantidad_registros: g.cantidad_registros,
    };

    if (g.tipo === "entrada") {
      item.detalles = g._eventos.map((e) => ({
        fecha: e.fecha,
        codigo_lote: e.detalle.codigo_lote,
        proveedor: e.detalle.nombre_proveedor,
        fecha_vencimiento: e.detalle.fecha_vencimiento,
        cantidad: e.cantidad,
      }));
    } else if (g.tipo === "salida") {
      item.detalles = g._eventos.map((e) => ({
        fecha: e.fecha,
        motivo: e.detalle.motivo,
        tipo_salida: e.detalle.tipo_salida,
        cantidad: e.cantidad,
      }));
    } else if (g.tipo === "venta") {
      item.detalles = g._eventos.map((e) => ({
        fecha: e.fecha,
        id_venta: e.detalle.id_venta,
        id_lista_venta: e.detalle.id_lista_venta,
        cantidad: e.cantidad,
      }));
    } else if (g.tipo === "movimiento") {
      item.detalles = g._eventos.map((e) => ({
        fecha: e.fecha,
        direccion: e.detalle.direccion,
        id_tienda_origen: e.detalle.id_tienda_origen,
        tienda_origen: e.detalle.tienda_origen,
        id_tienda_destino: e.detalle.id_tienda_destino,
        tienda_destino: e.detalle.tienda_destino,
        tipo_movimiento: e.detalle.tipo_movimiento,
        nota: e.detalle.nota,
        cantidad: e.cantidad,
      }));
      item.tiendas_destino = [
        ...new Set(
          g._eventos
            .filter((e) => e.detalle.direccion === "entrada")
            .map((e) => e.detalle.tienda_destino)
            .filter(Boolean)
        ),
      ];
      item.tiendas_origen = [
        ...new Set(
          g._eventos
            .filter((e) => e.detalle.direccion === "salida")
            .map((e) => e.detalle.tienda_origen)
            .filter(Boolean)
        ),
      ];
    }

    return item;
  });

  return {
    producto: {
      id_servicio: producto.id_servicio,
      nombre: producto.servicio.nombre,
      sufijo: producto.sufijo,
      unidad_medida: producto.unidad_medida,
    },
    tienda: {
      id_tienda: tienda.id_tienda,
      nombre: tienda.nombre,
    },
    rango: {
      desde: desde,
      hasta: hastaFilter,
    },
    stock_actual: st.cantidad !== null && st.cantidad !== undefined ? Number(st.cantidad) : null,
    total_grupos: seguimiento.length,
    seguimiento,
  };
};

module.exports = {
  createProducto,
  getProductoById,
  getProductosEnAlerta,
  filterProductos,
  updateProducto,
  deleteProducto,
  getSeguimientoInventario,
};