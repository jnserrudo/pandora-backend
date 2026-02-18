import * as notificationModel from '../models/notification.model.js';

/**
 * Obtiene todas las notificaciones del usuario autenticado.
 */
export const getMyNotifications = async (req, res) => {
    try {
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
        await notificationModel.markAsReadModel(id, req.user.id);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Marca todas las notificaciones como leídas.
 */
export const markAllAsRead = async (req, res) => {
    try {
        await notificationModel.markAllAsReadModel(req.user.id);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
