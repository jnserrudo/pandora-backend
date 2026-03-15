import * as userModel from '../models/user.model.js';
import * as auditService from '../services/audit.service.js';
import prisma from '../db/prismaClient.js';

/**
 * Obtiene el perfil del usuario actualmente autenticado.
 */
export const getMyProfile = async (req, res) => {
    try {
        // req.user.id es añadido por el middleware authenticateToken
        const userProfile = await userModel.getUserProfileModel(req.user.id);
        res.status(200).json(userProfile);
    } catch (error) {
        console.log(error);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

/**
 * Actualiza el perfil del usuario actualmente autenticado.
 */
export const updateMyProfile = async (req, res) => {
    try {
        const oldUser = await prisma.user.findUnique({ where: { id: req.user.id } });
        const updatedUser = await userModel.updateUserProfileModel(req.user.id, req.body);
        
        // Auditoría
        await auditService.createLog({
            userId: req.user.id,
            action: 'UPDATE',
            resourceType: 'USER',
            resourceId: req.user.id,
            oldData: oldUser,
            newData: updatedUser,
            ipAddress: req.ip
        });

        res.status(200).json(updatedUser);
    } catch (error) {
        console.log(error);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};