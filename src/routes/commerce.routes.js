// commerce.routes.js

import { Router } from 'express';
import {
    getCommerces,
    getCommerceById,
    createCommerce,
    getMyCommerce,
    updateMyCommerce,
    validateCommerce,
    getPendingCommerces,
} from '../controllers/commerce.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/authorize.middleware.js';

const router = Router();

// ===============================================
// ==           RUTAS PÚBLICAS                  ==
// ===============================================

// Obtener lista de todos los comercios activos.
// GET /api/commerces
router.get('/commerces', getCommerces);

// ===============================================
// ==           RUTAS PROTEGIDAS                ==
// ===============================================

// Obtener el comercio del usuario logueado.
// NOTA: Esta ruta debe ir ANTES que la ruta genérica con :id.
// GET /api/commerces/me
router.get('/commerces/me', authenticateToken, authorizeRole(['OWNER', 'ADMIN']), getMyCommerce);

// Obtener comercios pendientes (SOLO ADMIN)
// GET /api/commerces/pending
router.get('/commerces/pending', authenticateToken, authorizeRole(['ADMIN']), getPendingCommerces);

// Actualizar el comercio del usuario logueado.
// PUT /api/commerces/me
router.put('/commerces/me', authenticateToken, authorizeRole(['OWNER', 'ADMIN']), updateMyCommerce);

// Crear un nuevo comercio.
// POST /api/commerces
router.post('/commerces', authenticateToken, authorizeRole(['USER', 'ADMIN']), createCommerce);

// Validar comercio (SOLO ADMIN)
// PUT /api/commerces/:id/validate
router.put('/commerces/:id/validate', authenticateToken, authorizeRole(['ADMIN']), validateCommerce);


// ===============================================
// ==           RUTA GENÉRICA PÚBLICA           ==
// ===============================================

// Obtener un comercio específico por su ID.
// Esta ruta es la más genérica y debe ir ÚLTIMA para que no intercepte a las demás.
// GET /api/commerces/1
router.get('/commerces/:id', getCommerceById);

export default router;