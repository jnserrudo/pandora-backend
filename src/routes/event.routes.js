import { Router } from 'express';
import {
    getEvents,
    getEventById,
    createEvent,
    updateEvent,
    deleteEvent,
    updateEventStatus,
    validateEventPayment,
    getMyEvents,
    approveEvent,
    rejectEvent,
} from '../controllers/event.controller.js';
import { authenticateToken, optionalAuthenticate } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/authorize.middleware.js';

const router = Router();

// ===============================================
// ==           RUTAS PÚBLICAS (GET)            ==
// ===============================================

// Obtener la lista de todos los eventos programados (Agenda de Eventos)
// GET /api/events
router.get('/events', optionalAuthenticate, getEvents);

// Obtener eventos del usuario autenticado (DEBE IR ANTES DE /events/:id)
// GET /api/events/my-events
router.get('/events/my-events', authenticateToken, getMyEvents);

// Obtener un evento específico por su ID
// GET /api/events/:id
router.get('/events/:id', optionalAuthenticate, getEventById);

// ===============================================
// ==         RUTAS PROTEGIDAS                  ==
// ===============================================

// Crear un nuevo evento (requiere ser OWNER o ADMIN)
// POST /api/events
router.post('/events', authenticateToken, authorizeRole(['OWNER', 'ADMIN']), createEvent);

// Actualizar un evento (requiere ser OWNER o ADMIN)
// PUT /api/events/1
router.put('/events/:id', authenticateToken, authorizeRole(['OWNER', 'ADMIN']), updateEvent);

// Eliminar un evento (borrado lógico simplificado)
router.delete('/events/:id', authenticateToken, authorizeRole(['OWNER', 'ADMIN']), deleteEvent);

// Actualizar status (isActive) - Solo ADMIN
router.put('/events/:id/status', authenticateToken, authorizeRole(['ADMIN']), updateEventStatus);

router.patch('/events/:id/approve', authenticateToken, authorizeRole(['ADMIN']), approveEvent);
router.patch('/events/:id/reject', authenticateToken, authorizeRole(['ADMIN']), rejectEvent);

// Validar pago de evento - Solo ADMIN (PUT y PATCH: el front usa PATCH)
router.put('/events/:id/validate-payment', authenticateToken, authorizeRole(['ADMIN']), validateEventPayment);
router.patch('/events/:id/validate-payment', authenticateToken, authorizeRole(['ADMIN']), validateEventPayment);

export default router;