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

        const withEventCounts = await Promise.all(users.map(async (user) => {
            const eventCount = await prisma.event.count({
                where: { commerce: { ownerId: user.id } }
            });
            return {
                ...user,
                _count: {
                    ...user._count,
                    events: eventCount,
                }
            };
        }));

        res.status(200).json(withEventCounts);
    } catch (error) {
        console.error('[USER] Error:', error.message);
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
        console.error('[USER] Error:', error.message);
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

        const advertisements = await prisma.advertisement.findMany({
            where: { commerce: { ownerId: userId } },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({ events, commerces, advertisements });
    } catch (error) {
        console.error('[USER] Error:', error.message);
        res.status(500).json({ message: 'Error al obtener contenido del usuario' });
    }
};

/**
 * Actualiza rol / isActive de un usuario (solo ADMIN).
 */
export const adminUpdateUser = async (req, res) => {
    try {
        const targetId = parseInt(req.params.id);
        const { role, isActive } = req.body || {};

        if (!Number.isInteger(targetId)) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        const oldUser = await prisma.user.findUnique({ where: { id: targetId } });
        if (!oldUser) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        if (targetId === req.user.id && isActive === false) {
            return res.status(400).json({ message: 'No podés desactivar tu propia cuenta' });
        }

        const data = {};
        if (role !== undefined) {
            const allowed = ['USER', 'OWNER', 'ADMIN'];
            if (!allowed.includes(role)) {
                return res.status(400).json({ message: 'Rol inválido' });
            }
            data.role = role;
        }
        if (isActive !== undefined) {
            data.isActive = Boolean(isActive);
        }
        if (Object.keys(data).length === 0) {
            return res.status(400).json({ message: 'Nada para actualizar' });
        }

        const updatedUser = await prisma.user.update({
            where: { id: targetId },
            data,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                createdAt: true,
            }
        });

        await auditService.createLog({
            userId: req.user.id,
            action: 'UPDATE',
            resourceType: 'USER',
            resourceId: targetId,
            oldData: { role: oldUser.role, isActive: oldUser.isActive },
            newData: { role: updatedUser.role, isActive: updatedUser.isActive },
            ipAddress: req.ip
        });

        res.status(200).json(updatedUser);
    } catch (error) {
        console.error('[USER] Error:', error.message);
        res.status(500).json({ message: 'Error al actualizar usuario' });
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
        console.error('[USER] Error:', error.message);
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
        console.error('[USER] Error:', error.message);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};