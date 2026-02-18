import prisma from '../db/prismaClient.js';

/**
 * Crea una nueva notificación para un usuario.
 */
export const createNotificationModel = async (userId, type, message, referenceId = null) => {
    return prisma.notification.create({
        data: {
            userId: parseInt(userId),
            type,
            message,
            referenceId: referenceId ? parseInt(referenceId) : null,
        }
    });
};

/**
 * Obtiene todas las notificaciones de un usuario, no leídas primero.
 */
export const getUserNotificationsModel = async (userId) => {
    return prisma.notification.findMany({
        where: { userId: parseInt(userId) },
        orderBy: [
            { isRead: 'asc' }, // false (0) viene antes que true (1) en orden ascendente? No, false < true, so asc is false then true.
            { createdAt: 'desc' }
        ]
    });
};

/**
 * Marca una notificación como leída.
 */
export const markAsReadModel = async (id, userId) => {
    return prisma.notification.update({
        where: { id: parseInt(id), userId: parseInt(userId) },
        data: { isRead: true }
    });
};

/**
 * Marca todas las notificaciones del usuario como leídas.
 */
export const markAllAsReadModel = async (userId) => {
    return prisma.notification.updateMany({
        where: { userId: parseInt(userId), isRead: false },
        data: { isRead: true }
    });
};
