import { Router } from 'express';
import { createEvent, getEventsByCommerce, updateEvent, deleteEvent } from '../controllers/event.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/authorize.middleware.js';
const router = Router();
router.get('/events/by-commerce/:commerceId', getEventsByCommerce); // Ruta pública
router.post('/events', authenticateToken, authorizeRole(['OWNER', 'ADMIN']), createEvent);
router.put('/events/:id', authenticateToken, authorizeRole(['OWNER', 'ADMIN']), updateEvent);
router.delete('/events/:id', authenticateToken, authorizeRole(['OWNER', 'ADMIN']), deleteEvent);
export default router;