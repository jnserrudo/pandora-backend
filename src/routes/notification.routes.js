import { Router } from 'express';
import {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
} from '../controllers/notification.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

// Todas las rutas de notificaciones requieren autenticación
router.get('/notifications', authenticateToken, getMyNotifications);
router.patch('/notifications/read-all', authenticateToken, markAllAsRead);
router.delete('/notifications', authenticateToken, clearAllNotifications);
router.patch('/notifications/:id/read', authenticateToken, markAsRead);
router.delete('/notifications/:id', authenticateToken, deleteNotification);

export default router;
