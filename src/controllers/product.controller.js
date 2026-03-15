import prisma from '../db/prismaClient.js';
import { throwError } from '../utils/error.utils.js';
import * as auditService from '../services/audit.service.js';

export const getProductsByCommerceId = async (req, res) => {
    try {
        const { commerceId } = req.params;
        const products = await prisma.product.findMany({
            where: { commerceId: parseInt(commerceId), isActive: true },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const createProduct = async (req, res) => {
    try {
        const { commerceId } = req.params;
        const { name, description, price, imageUrl } = req.body;

        // Verificar plan (Plata=2, Oro=3, Platino=4)
        const commerce = await prisma.commerce.findUnique({
            where: { id: parseInt(commerceId) },
            select: { planLevel: true, ownerId: true }
        });

        if (!commerce || commerce.planLevel < 2) {
            throwError('Tu plan actual no permite gestionar un catálogo de productos.', 403);
        }

        if (commerce.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
            throwError('No tienes permiso para gestionar productos de este comercio.', 403);
        }

        // Límite estricto de productos para el Plan Plata (6 items)
        if (commerce.planLevel === 2) {
            const productCount = await prisma.product.count({
                where: { commerceId: parseInt(commerceId), isActive: true }
            });
            if (productCount >= 6) {
                throwError('El Plan Plata permite un máximo de 6 productos en el catálogo. Actualiza al Plan Oro para tener ítems ilimitados.', 403);
            }
        }

        const product = await prisma.product.create({
            data: {
                commerceId: parseInt(commerceId),
                name,
                description,
                price,
                imageUrl
            }
        });

        // Auditoría
        await auditService.createLog({
            userId: req.user.id,
            action: 'CREATE',
            resourceType: 'PRODUCT',
            resourceId: product.id,
            newData: product,
            ipAddress: req.ip
        });

        res.status(201).json(product);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await prisma.product.findUnique({ where: { id: parseInt(id) }, include: { commerce: true } });

        if (!product) throwError('Producto no encontrado.', 404);
        if (product.commerce.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
            throwError('No tienes permiso.', 403);
        }

        const oldProduct = await prisma.product.findUnique({ where: { id: parseInt(id) } });
        await prisma.product.update({ where: { id: parseInt(id) }, data: { isActive: false } });
        
        // Auditoría
        await auditService.createLog({
            userId: req.user.id,
            action: 'DELETE',
            resourceType: 'PRODUCT',
            resourceId: parseInt(id),
            oldData: oldProduct,
            ipAddress: req.ip
        });

        res.status(204).send();
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};
