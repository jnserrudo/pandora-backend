import prisma from '../db/prismaClient.js';
import { throwError } from '../utils/error.utils.js';
import * as auditService from '../services/audit.service.js';

export const getBranchesByCommerceId = async (req, res) => {
    try {
        const { commerceId } = req.params;
        const branches = await prisma.branch.findMany({
            where: { commerceId: Number(commerceId) }
        });
        res.status(200).json(branches);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const createBranch = async (req, res) => {
    try {
        const { commerceId } = req.params;
        const { name, address, phone, isMain } = req.body;

        const commerce = await prisma.commerce.findUnique({
            where: { id: Number(commerceId) },
            include: { branches: true }
        });

        if (!commerce) throwError('Comercio no encontrado', 404);
        
        // Validación de Plan
        // Plan Free (1): 1 sucursal (Casa Central)
        // Plan Plata (2): Hasta 3 sucursales
        // Plan Oro/Platino (3, 4): Ilimitadas
        if (commerce.planLevel === 1 && commerce.branches.length >= 1) {
            throwError('Tu plan Free no permite añadir más sucursales.', 403);
        }
        if (commerce.planLevel === 2 && commerce.branches.length >= 3) {
            throwError('Tu plan Plata permite un máximo de 3 sucursales. Mejora a plan Oro para sucursales ilimitadas.', 403);
        }

        const branch = await prisma.branch.create({
            data: {
                name,
                address,
                phone,
                isMain: isMain || false,
                commerceId: Number(commerceId)
            }
        });

        // Auditoría
        await auditService.createLog({
            userId: req.user.id,
            action: 'CREATE',
            resourceType: 'BRANCH',
            resourceId: branch.id,
            newData: branch,
            ipAddress: req.ip
        });

        res.status(201).json(branch);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const deleteBranch = async (req, res) => {
    try {
        const { id } = req.params;
        
        const branch = await prisma.branch.findUnique({ where: { id: Number(id) } });
        if (!branch) throwError('Sucursal no encontrada', 404);
        if (branch.isMain) throwError('No se puede eliminar la sucursal principal', 400);

        const oldBranch = await prisma.branch.findUnique({ where: { id: Number(id) } });
        await prisma.branch.delete({ where: { id: Number(id) } });
        
        // Auditoría
        await auditService.createLog({
            userId: req.user.id,
            action: 'DELETE',
            resourceType: 'BRANCH',
            resourceId: Number(id),
            oldData: oldBranch,
            ipAddress: req.ip
        });

        res.status(200).json({ message: 'Sucursal eliminada' });
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};
