import prisma from '../db/prismaClient.js';
import { throwError } from '../utils/error.utils.js';
import * as auditService from '../services/audit.service.js';

/**
 * Obtener categorías.
 * Query: ?home=1 → solo visibles en Home, ordenadas por homeOrder.
 * Admin: ?includeInactive=1 → incluye isActive=false (requiere auth en ruta aparte si se usa).
 */
export const getCategories = async (req, res) => {
  try {
    const homeOnly = req.query.home === '1' || req.query.home === 'true';
    const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';

    const categories = await prisma.category.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        ...(homeOnly ? { showOnHome: true } : {}),
      },
      orderBy: [{ homeOrder: 'asc' }, { name: 'asc' }],
    });
    res.status(200).json(categories);
  } catch (error) {
    console.error('[CATEGORY] Error obteniendo categorías:', error.message);
    res.status(500).json({ message: 'Error al obtener las categorías' });
  }
};

/**
 * Crear una nueva categoría (Sólo ADMIN).
 */
export const createCategory = async (req, res) => {
  try {
    const { name, slug, description, showOnHome, homeOrder } = req.body;
    if (!name || !slug) {
      throwError('Nombre y Slug son requeridos', 400);
    }

    const maxOrder = await prisma.category.aggregate({ _max: { homeOrder: true } });
    const nextOrder =
      homeOrder != null ? parseInt(homeOrder, 10) : (maxOrder._max.homeOrder ?? 0) + 1;

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description,
        showOnHome: showOnHome !== undefined ? Boolean(showOnHome) : true,
        homeOrder: Number.isFinite(nextOrder) ? nextOrder : 0,
      },
    });

    await auditService.createLog({
      userId: req.user.id,
      action: 'CREATE',
      resourceType: 'CATEGORY',
      resourceId: category.id,
      newData: category,
      req
    });

    res.status(201).json(category);
  } catch (error) {
    console.error('[CATEGORY] Error creando categoría:', error.message);
    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 ? 'Error al crear la categoría' : error.message;
    res.status(statusCode).json({ message });
  }
};

/**
 * Actualizar una categoría (Sólo ADMIN).
 */
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, description, isActive, showOnHome, homeOrder } = req.body;

    const oldCategory = await prisma.category.findUnique({ where: { id: parseInt(id, 10) } });
    if (!oldCategory) throwError('Categoría no encontrada', 404);

    const data = {};
    if (name !== undefined) data.name = name;
    if (slug !== undefined) data.slug = slug;
    if (description !== undefined) data.description = description;
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (showOnHome !== undefined) data.showOnHome = Boolean(showOnHome);
    if (homeOrder !== undefined) data.homeOrder = parseInt(homeOrder, 10) || 0;

    const category = await prisma.category.update({
      where: { id: parseInt(id, 10) },
      data,
    });

    await auditService.createLog({
      userId: req.user.id,
      action: 'UPDATE',
      resourceType: 'CATEGORY',
      resourceId: category.id,
      oldData: oldCategory,
      newData: category,
      req
    });

    res.status(200).json(category);
  } catch (error) {
    console.error('[CATEGORY] Error actualizando categoría:', error.message);
    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 ? 'Error al actualizar la categoría' : error.message;
    res.status(statusCode).json({ message });
  }
};

/**
 * Guardar orden y visibilidad de Home en lote (Sólo ADMIN).
 * Body: { items: [{ id, showOnHome, homeOrder }] }
 */
export const updateHomeCategories = async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      throwError('Enviá items: [{ id, showOnHome, homeOrder }]', 400);
    }

    const updated = await prisma.$transaction(
      items.map((item, index) => {
        const id = parseInt(item.id, 10);
        if (!Number.isFinite(id)) {
          throwError(`id inválido en items[${index}]`, 400);
        }
        const order =
          item.homeOrder !== undefined && item.homeOrder !== null
            ? parseInt(item.homeOrder, 10)
            : index + 1;
        return prisma.category.update({
          where: { id },
          data: {
            showOnHome: item.showOnHome !== undefined ? Boolean(item.showOnHome) : true,
            homeOrder: Number.isFinite(order) ? order : index + 1,
          },
        });
      })
    );

    await auditService.createLog({
      userId: req.user.id,
      action: 'UPDATE',
      resourceType: 'CATEGORY',
      resourceId: 0,
      newData: { homeConfig: updated.map((c) => ({ id: c.id, showOnHome: c.showOnHome, homeOrder: c.homeOrder })) },
      req
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error('[CATEGORY] Error guardando home config:', error.message);
    const statusCode = error.statusCode || 500;
    const message =
      statusCode === 500 ? 'Error al guardar el orden de categorías' : error.message;
    res.status(statusCode).json({ message });
  }
};

/**
 * Eliminar una categoría (Borrado lógico - Sólo ADMIN).
 */
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const oldCategory = await prisma.category.findUnique({ where: { id: parseInt(id, 10) } });
    await prisma.category.update({
      where: { id: parseInt(id, 10) },
      data: { isActive: false },
    });

    await auditService.createLog({
      userId: req.user.id,
      action: 'DELETE',
      resourceType: 'CATEGORY',
      resourceId: parseInt(id, 10),
      oldData: oldCategory,
      req
    });

    res.status(204).send();
  } catch (error) {
    console.error('[CATEGORY] Error eliminando categoría:', error.message);
    res.status(500).json({ message: 'Error al eliminar la categoría' });
  }
};
