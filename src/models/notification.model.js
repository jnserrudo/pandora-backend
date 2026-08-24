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
        orderBy: { createdAt: 'desc' }
    });
};

/**
 * Marca una notificación como leída.
 */
export const markAsReadModel = async (id, userId) => {
    const existing = await prisma.notification.findFirst({
        where: { id: parseInt(id), userId: parseInt(userId) },
    });
    if (!existing) {
        const err = new Error('Notificación no encontrada.');
        err.statusCode = 404;
        throw err;
    }
    return prisma.notification.update({
        where: { id: existing.id },
        data: { isRead: true },
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

/**
 * Elimina una notificación del usuario.
 */
export const deleteNotificationModel = async (id, userId) => {
    const existing = await prisma.notification.findFirst({
        where: { id: parseInt(id), userId: parseInt(userId) },
    });
    if (!existing) {
        const err = new Error('Notificación no encontrada.');
        err.statusCode = 404;
        throw err;
    }
    await prisma.notification.delete({ where: { id: existing.id } });
    return existing;
};

/**
 * Vacía el casillero de notificaciones del usuario.
 * @returns {{ count: number, snapshot: Array }} cantidad eliminada y muestra previa
 */
export const clearAllNotificationsModel = async (userId) => {
    const uid = parseInt(userId);
    const snapshot = await prisma.notification.findMany({
        where: { userId: uid },
        select: { id: true, type: true, message: true, referenceId: true, isRead: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });
    const result = await prisma.notification.deleteMany({
        where: { userId: uid },
    });
    return { count: result.count, snapshot };
};

/**
 * Si el usuario es ADMIN, crea notificaciones faltantes para eventos PENDING
 * (cubre el caso de eventos creados antes de existir NEW_EVENT_REQUEST).
 */
export const ensurePendingEventNotificationsModel = async (userId) => {
    const user = await prisma.user.findUnique({
        where: { id: parseInt(userId) },
        select: { id: true, role: true },
    });
    if (!user || user.role !== 'ADMIN') return;

    const pendingEvents = await prisma.event.findMany({
        where: { status: 'PENDING' },
        select: { id: true, name: true },
    });
    if (pendingEvents.length === 0) return;

    const existing = await prisma.notification.findMany({
        where: {
            userId: user.id,
            type: 'NEW_EVENT_REQUEST',
            referenceId: { in: pendingEvents.map((e) => e.id) },
        },
        select: { referenceId: true },
    });
    const have = new Set(existing.map((n) => n.referenceId));

    for (const ev of pendingEvents) {
        if (have.has(ev.id)) continue;
        await prisma.notification.create({
            data: {
                userId: user.id,
                type: 'NEW_EVENT_REQUEST',
                message: `Nuevo evento pendiente de validación: ${ev.name}`,
                referenceId: ev.id,
            },
        });
    }
};
