import * as userModel from '../models/user.model.js';
import * as auditService from '../services/audit.service.js';
import prisma from '../db/prismaClient.js';

/**
 * Obtiene todos los usuarios (ADMIN)
 */
export const getAllUsers = async (req, res) => {
    try {
        const { search } = req.query;
        const users = await prisma.user.findMany({
            where: search ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } }
                ]
            } : undefined,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                createdAt: true,
                _count: {
                    select: {
                        commerces: true,
                        articles: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener usuarios' });
    }
};

/**
 * Obtiene un usuario por ID (ADMIN)
 */
export const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findUnique({
            where: { id: parseInt(id) },
            include: {
                commerces: true,
                articles: true,
                _count: {
                    select: {
                        commerces: true,
                        articles: true
                    }
                }
            }
        });
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        res.status(200).json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener usuario' });
    }
};

/**
 * Obtiene el contenido de un usuario (eventos, comercios) (ADMIN)
 */
export const getUserContent = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = parseInt(id);

        // Obtener comercios del usuario
        const commerces = await prisma.commerce.findMany({
            where: { ownerId: userId },
            include: {
                events: true // Incluir eventos de cada comercio
            },
            orderBy: { createdAt: 'desc' }
        });

        // Extraer todos los eventos de los comercios
        const events = commerces.flatMap(commerce => commerce.events || []);

        res.status(200).json({ events, commerces });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener contenido del usuario' });
    }
};

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