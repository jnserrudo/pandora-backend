import * as commerceModel from '../models/commerce.model.js';
import * as notificationModel from '../models/notification.model.js';
import prisma from '../db/prismaClient.js';
import { throwError } from '../utils/error.utils.js';
// --- CONTROLADORES PÚBLICOS ---

export const getCommerces = async (req, res) => {
    const { category } = req.query;
    console.log("getCommerces", category);
    try {
        const commerces = category
            ? await commerceModel.getCommercesByCategoryModel(category) // Pasamos el string tal cual
            : await commerceModel.getAllCommercesModel();
        res.status(200).json(commerces);
    } catch (error) {
        console.log(error);
        res.status(error.statusCode || 500).json({ message: error.message });
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
        console.log(error);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const getPendingCommerces = async (req, res) => {
    try {
        const commerces = await commerceModel.getPendingCommercesModel();
        res.status(200).json(commerces);
    } catch (error) {
        console.log(error);
        res.status(error.statusCode || 500).json({ message: error.message });
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

        res.status(201).json(commerce);
    } catch (error) {
        console.log(error);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const validateCommerce = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;

        if (!['ACTIVE', 'REJECTED'].includes(status)) {
            throwError('Invalid status. Use ACTIVE or REJECTED.', 400);
        }

        const commerce = await commerceModel.validateCommerceModel(id, req.user.id, status, reason);

        // Notificar al dueño
        await notificationModel.createNotificationModel(
            commerce.ownerId,
            'COMMERCE_VALIDATED',
            status === 'ACTIVE' 
                ? `¡Tu comercio "${commerce.name}" ha sido aprobado!` 
                : `Tu comercio "${commerce.name}" ha sido rechazado. Razón: ${reason || 'No especificada'}`,
            commerce.id
        );

        res.status(200).json(commerce);
    } catch (error) {
        console.log(error);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const getMyCommerce = async (req, res) => {
    try {
        console.log("getMyCommerce", req.user.id);
        const commerce = await commerceModel.getCommerceByOwnerModel(req.user.id);
        console.log("getMyCommerce", commerce);
        res.status(200).json(commerce);
    } catch (error) {
        console.log(error);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const updateCommerce = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("updateCommerce by ID:", id, "user:", req.user.id);
        const updatedCommerce = await commerceModel.updateCommerceModel(id, req.body, req.user.id, req.user.role);
        res.status(200).json(updatedCommerce);
    } catch (error) {
        console.log(error);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const updateMyCommerce = async (req, res) => {
    try {
        console.log("updateMyCommerce", req.user.id);
        const updatedCommerce = await commerceModel.updateCommerceByOwnerModel(req.user.id, req.body);
        console.log("updateMyCommerce", updatedCommerce);
        res.status(200).json(updatedCommerce);
    } catch (error) {
        console.log(error);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};
