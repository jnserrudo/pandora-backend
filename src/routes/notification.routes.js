import { Router } from 'express';
import { getMyNotifications, markAsRead, markAllAsRead } from '../controllers/notification.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

// Todas las rutas de notificaciones requieren autenticación
router.get('/notifications', authenticateToken, getMyNotifications);
router.patch('/notifications/:id/read', authenticateToken, markAsRead);
router.patch('/notifications/read-all', authenticateToken, markAllAsRead);

export default router;
