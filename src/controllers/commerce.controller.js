import * as commerceModel from '../models/commerce.model.js';
import * as notificationModel from '../models/notification.model.js';
import * as emailService from '../services/email.service.js';
import * as auditService from '../services/audit.service.js';
import prisma from '../db/prismaClient.js';
import { throwError } from '../utils/error.utils.js';
// --- CONTROLADORES PÚBLICOS ---

export const getCommerces = async (req, res) => {
    const { category, planLevel, page = 1, limit = 50 } = req.query;
    const safeLimit = Math.min(parseInt(limit), 100);
    const skip = (parseInt(page) - 1) * safeLimit;
    const includeAll = req.user?.role === 'ADMIN';
    console.log(`[COMMERCE] getCommerces - categoría: ${category}, plan: ${planLevel}, página: ${page}`);
    try {
        let commerces;
        if (category && !includeAll) {
            commerces = await commerceModel.getCommercesByCategoryModel(category, { skip, limit: safeLimit });
        } else {
            commerces = await commerceModel.getAllCommercesModel(planLevel, { skip, limit: safeLimit, includeAll });
        }
        res.status(200).json(commerces);
    } catch (error) {
        console.error('[COMMERCE] Error obteniendo comercios:', error.message);
        const statusCode = error.statusCode || 500;
        const message = statusCode === 500 ? "Error interno del servidor" : error.message;
        res.status(statusCode).json({ message });
    }
};

export const getCommerceById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id || !Number(id)) {
            throwError('El ID del comercio es requerido.', 400);
        }
        const commerce = await commerceModel.getCommerceByIdModel(id, req.user || null);
        res.status(200).json(commerce);
    } catch (error) {
        console.error('[COMMERCE] Error obteniendo comercio por ID:', error.message);
        const statusCode = error.statusCode || 500;
        const message = statusCode === 500 ? "Error interno del servidor" : error.message;
        res.status(statusCode).json({ message });
    }
};

export const getPendingCommerces = async (req, res) => {
    try {
        const commerces = await commerceModel.getPendingCommercesModel();
        res.status(200).json(commerces);
    } catch (error) {
        console.error('[COMMERCE] Error obteniendo comercios pendientes:', error.message);
        const statusCode = error.statusCode || 500;
        const message = statusCode === 500 ? "Error interno del servidor" : error.message;
        res.status(statusCode).json({ message });
    }
};

// --- CONTROLADORES PROTEGIDOS ---

export const createCommerce = async (req, res) => {
    try {
        const commerce = await commerceModel.createCommerceModel(req.body, req.user.id);
        
        // Notificar a los administradores
        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
        for (const admin of admins) {
            await notificationModel.createNotificationModel(
                admin.id,
                'NEW_COMMERCE_REQUEST',
                `Nuevo comercio pendiente de validación: ${commerce.name}`,
                commerce.id
            );
        }

        // Notificación por EMAIL a admins (opcional, según config)
        if (process.env.ADMIN_EMAIL) {
            await emailService.notifyNewCommerceSubmission(commerce);
        }

        // Auditoría
        await auditService.createLog({
            userId: req.user.id,
            action: 'CREATE',
            resourceType: 'COMMERCE',
            resourceId: commerce.id,
            newData: commerce,
            ipAddress: req.ip
        });

        res.status(201).json(commerce);
    } catch (error) {
        console.error('[COMMERCE] Error creando comercio:', error.message);
        const statusCode = error.statusCode || 500;
        const message = statusCode === 500 ? "Error interno del servidor" : error.message;
        res.status(statusCode).json({ message });
    }
};

export const validateCommerce = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason, isValidated } = req.body;

        if (isValidated !== undefined) {
            throwError("El campo isValidated ya no se usa. Enviá { status: 'ACTIVE' } o { status: 'REJECTED' }.", 400);
        }

        if (!['ACTIVE', 'REJECTED'].includes(status)) {
            throwError('Estado inválido. Usá ACTIVE o REJECTED.', 400);
        }

        const oldCommerce = await prisma.commerce.findUnique({ where: { id: parseInt(id) } });
        const commerce = await commerceModel.validateCommerceModel(id, req.user.id, status, reason);

        // Auditoría
        await auditService.createLog({
            userId: req.user.id,
            action: 'STATUS_CHANGE',
            resourceType: 'COMMERCE',
            resourceId: commerce.id,
            oldData: oldCommerce,
            newData: commerce,
            ipAddress: req.ip
        });

        // Notificar al dueño
        await notificationModel.createNotificationModel(
            commerce.ownerId,
            'COMMERCE_VALIDATED',
            status === 'ACTIVE' 
                ? `¡Tu comercio "${commerce.name}" ha sido aprobado!` 
                : `Tu comercio "${commerce.name}" ha sido rechazado. Razón: ${reason || 'No especificada'}`,
            commerce.id
        );

        // Notificación por EMAIL al dueño
        try {
            if (commerce && commerce.owner && commerce.owner.email) {
                await emailService.notifyCommerceStatusUpdate(
                    commerce.owner.email, 
                    commerce.name, 
                    status, 
                    reason
                );
            } else {
                console.warn(`[COMMERCE] No se pudo enviar email para comercio ${id}: dueño o email faltante`);
            }
        } catch (emailError) {
            console.error("[COMMERCE] Error enviando email de validación:", emailError.message);
            // We don't throw here to avoid 500, since validation was successful
        }

        res.status(200).json(commerce);
    } catch (error) {
        console.error('[COMMERCE] Error validando comercio:', error.message);
        const statusCode = error.statusCode || 500;
        const message = statusCode === 500 ? "Error interno del servidor" : error.message;
        res.status(statusCode).json({ message });
    }
};

export const getMyCommerce = async (req, res) => {
    try {
        const commerce = await commerceModel.getCommerceByOwnerModel(req.user.id);
        res.status(200).json(commerce);
    } catch (error) {
        console.error('[COMMERCE] Error obteniendo mi comercio:', error.message);
        const statusCode = error.statusCode || 500;
        const message = statusCode === 500 ? "Error interno del servidor" : error.message;
        res.status(statusCode).json({ message });
    }
};

export const updateCommerce = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[COMMERCE] updateCommerce - ID: ${id}, usuario: ${req.user.id}`);
        const oldCommerce = await prisma.commerce.findUnique({ where: { id: parseInt(id) } });
        const updatedCommerce = await commerceModel.updateCommerceModel(id, req.body, req.user.id, req.user.role);
        
        // Auditoría
        await auditService.createLog({
            userId: req.user.id,
            action: 'UPDATE',
            resourceType: 'COMMERCE',
            resourceId: updatedCommerce.id,
            oldData: oldCommerce,
            newData: updatedCommerce,
            ipAddress: req.ip
        });

        res.status(200).json(updatedCommerce);
    } catch (error) {
        console.error('[COMMERCE] Error actualizando comercio:', error.message);
        const statusCode = error.statusCode || 500;
        const message = statusCode === 500 ? "Error interno del servidor" : error.message;
        res.status(statusCode).json({ message });
    }
};

export const updateMyCommerce = async (req, res) => {
    try {
        const updatedCommerce = await commerceModel.updateCommerceByOwnerModel(req.user.id, req.body);
        res.status(200).json(updatedCommerce);
    } catch (error) {
        console.error('[COMMERCE] Error actualizando mi comercio:', error.message);
        const statusCode = error.statusCode || 500;
        const message = statusCode === 500 ? "Error interno del servidor" : error.message;
        res.status(statusCode).json({ message });
    }
};
