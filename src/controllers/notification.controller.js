import * as notificationModel from '../models/notification.model.js';
import * as auditService from '../services/audit.service.js';

/**
 * Obtiene todas las notificaciones del usuario autenticado.
 */
export const getMyNotifications = async (req, res) => {
    try {
        // Autocura: eventos PENDING sin aviso previo (p.ej. creados antes del fix)
        await notificationModel.ensurePendingEventNotificationsModel(req.user.id);
        const notifications = await notificationModel.getUserNotificationsModel(req.user.id);
        res.status(200).json(notifications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Marca una notificación específica como leída.
 */
export const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await notificationModel.markAsReadModel(id, req.user.id);
        await auditService.createLog({
            userId: req.user.id,
            action: 'UPDATE',
            resourceType: 'NOTIFICATION',
            resourceId: updated.id,
            oldData: { isRead: false },
            newData: { isRead: true, type: updated.type, referenceId: updated.referenceId },
            ipAddress: req.ip,
        });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

/**
 * Marca todas las notificaciones como leídas.
 */
export const markAllAsRead = async (req, res) => {
    try {
        const result = await notificationModel.markAllAsReadModel(req.user.id);
        await auditService.createLog({
            userId: req.user.id,
            action: 'UPDATE',
            resourceType: 'NOTIFICATION',
            resourceId: req.user.id,
            oldData: { scope: 'all_unread' },
            newData: { markedRead: result.count ?? true },
            ipAddress: req.ip,
        });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Elimina una notificación.
 */
export const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await notificationModel.deleteNotificationModel(id, req.user.id);
        await auditService.createLog({
            userId: req.user.id,
            action: 'DELETE',
            resourceType: 'NOTIFICATION',
            resourceId: deleted.id,
            oldData: deleted,
            newData: null,
            ipAddress: req.ip,
        });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

/**
 * Vacía todas las notificaciones del usuario.
 */
export const clearAllNotifications = async (req, res) => {
    try {
        const { count, snapshot } = await notificationModel.clearAllNotificationsModel(req.user.id);
        await auditService.createLog({
            userId: req.user.id,
            action: 'DELETE',
            resourceType: 'NOTIFICATION',
            resourceId: req.user.id,
            oldData: { clearedCount: count, sample: snapshot },
            newData: { clearedCount: count },
            ipAddress: req.ip,
        });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
