import * as commerceModel from '../models/commerce.model.js';
import * as notificationModel from '../models/notification.model.js';
import * as emailService from '../services/email.service.js';
import * as auditService from '../services/audit.service.js';
import prisma from '../db/prismaClient.js';
import { throwError } from '../utils/error.utils.js';
// --- CONTROLADORES PÚBLICOS ---

export const getCommerces = async (req, res) => {
    const { category, planLevel } = req.query;
    console.log("getCommerces filters:", { category, planLevel });
    try {
        let commerces;
        if (category) {
            commerces = await commerceModel.getCommercesByCategoryModel(category);
        } else {
            // Pasamos planLevel (si existe) al modelo
            commerces = await commerceModel.getAllCommercesModel(planLevel);
        }
        res.status(200).json(commerces);
    } catch (error) {
        console.error("Error in getCommerces:", error);
        const statusCode = error.statusCode || 500;
        const message = statusCode === 500 ? "Error interno del servidor" : error.message;
        res.status(statusCode).json({ message });
    }
};

export const getCommerceById = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("getCommerceById", id);
        if (!id || !Number(id)) {
            console.log('Commerce ID is required.');
            throwError('Commerce ID is required.', 400);
        }
        const commerce = await commerceModel.getCommerceByIdModel(id);
        res.status(200).json(commerce);
    } catch (error) {
        console.error("Error in getCommerceById:", error);
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
        console.error("Error in getPendingCommerces:", error);
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
        console.error("Error in createCommerce:", error);
        const statusCode = error.statusCode || 500;
        const message = statusCode === 500 ? "Error interno del servidor" : error.message;
        res.status(statusCode).json({ message });
    }
};

export const validateCommerce = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;

        if (!['ACTIVE', 'REJECTED'].includes(status)) {
            throwError('Invalid status. Use ACTIVE or REJECTED.', 400);
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
                console.warn(`Could not send email for commerce ${id}: owner or email missing`);
            }
        } catch (emailError) {
            console.error("Error sending validation email:", emailError);
            // We don't throw here to avoid 500, since validation was successful
        }

        res.status(200).json(commerce);
    } catch (error) {
        console.error("Error in validateCommerce:", error);
        const statusCode = error.statusCode || 500;
        const message = statusCode === 500 ? "Error interno del servidor" : error.message;
        res.status(statusCode).json({ message });
    }
};

export const getMyCommerce = async (req, res) => {
    try {
        console.log("getMyCommerce", req.user.id);
        const commerce = await commerceModel.getCommerceByOwnerModel(req.user.id);
        console.log("getMyCommerce", commerce);
        res.status(200).json(commerce);
    } catch (error) {
        console.error("Error in getMyCommerce:", error);
        const statusCode = error.statusCode || 500;
        const message = statusCode === 500 ? "Error interno del servidor" : error.message;
        res.status(statusCode).json({ message });
    }
};

export const updateCommerce = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("updateCommerce by ID:", id, "user:", req.user.id);
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
        console.error("Error in updateCommerce:", error);
        const statusCode = error.statusCode || 500;
        const message = statusCode === 500 ? "Error interno del servidor" : error.message;
        res.status(statusCode).json({ message });
    }
};

export const updateMyCommerce = async (req, res) => {
    try {
        console.log("updateMyCommerce", req.user.id);
        const updatedCommerce = await commerceModel.updateCommerceByOwnerModel(req.user.id, req.body);
        console.log("updateMyCommerce", updatedCommerce);
        res.status(200).json(updatedCommerce);
    } catch (error) {
        console.error("Error in updateMyCommerce:", error);
        const statusCode = error.statusCode || 500;
        const message = statusCode === 500 ? "Error interno del servidor" : error.message;
        res.status(statusCode).json({ message });
    }
};
