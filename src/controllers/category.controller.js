import prisma from '../db/prismaClient.js';
import { throwError } from '../utils/error.utils.js';
import * as auditService from '../services/audit.service.js';

/**
 * Obtener todas las categorías (Público).
 */
export const getCategories = async (req, res) => {
    try {
        const categories = await prisma.category.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' }
        });
        res.status(200).json(categories);
    } catch (error) {
        console.error("Error in getCategories:", error);
        res.status(500).json({ message: "Error al obtener las categorías" });
    }
};

/**
 * Crear una nueva categoría (Sólo ADMIN).
 */
export const createCategory = async (req, res) => {
    try {
        const { name, slug, description } = req.body;
        if (!name || !slug) {
            throwError("Nombre y Slug son requeridos", 400);
        }

        const category = await prisma.category.create({
            data: { name, slug, description }
        });

        // Auditoría
        await auditService.createLog({
            userId: req.user.id,
            action: 'CREATE',
            resourceType: 'CATEGORY',
            resourceId: category.id,
            newData: category,
            ipAddress: req.ip
        });

        res.status(201).json(category);
    } catch (error) {
        console.error("Error in createCategory:", error);
        const statusCode = error.statusCode || 500;
        const message = statusCode === 500 ? "Error al crear la categoría" : error.message;
        res.status(statusCode).json({ message });
    }
};

/**
 * Actualizar una categoría (Sólo ADMIN).
 */
export const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, slug, description, isActive } = req.body;

        const oldCategory = await prisma.category.findUnique({ where: { id: parseInt(id) } });
        const category = await prisma.category.update({
            where: { id: parseInt(id) },
            data: { name, slug, description, isActive }
        });

        // Auditoría
        await auditService.createLog({
            userId: req.user.id,
            action: 'UPDATE',
            resourceType: 'CATEGORY',
            resourceId: category.id,
            oldData: oldCategory,
            newData: category,
            ipAddress: req.ip
        });

        res.status(200).json(category);
    } catch (error) {
        console.error("Error in updateCategory:", error);
        const statusCode = error.statusCode || 500;
        const message = statusCode === 500 ? "Error al actualizar la categoría" : error.message;
        res.status(statusCode).json({ message });
    }
};

/**
 * Eliminar una categoría (Borrado lógico - Sólo ADMIN).
 */
export const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const oldCategory = await prisma.category.findUnique({ where: { id: parseInt(id) } });
        await prisma.category.update({
            where: { id: parseInt(id) },
            data: { isActive: false }
        });

        // Auditoría
        await auditService.createLog({
            userId: req.user.id,
            action: 'DELETE',
            resourceType: 'CATEGORY',
            resourceId: parseInt(id),
            oldData: oldCategory,
            ipAddress: req.ip
        });

        res.status(204).send();
    } catch (error) {
        console.error("Error in deleteCategory:", error);
        res.status(500).json({ message: "Error al eliminar la categoría" });
    }
};
