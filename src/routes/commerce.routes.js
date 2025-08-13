import { Router } from 'express';
import {
    getCommerces,
    getCommerceById,
    createCommerce,
    getMyCommerce,
    updateMyCommerce,
} from '../controllers/commerce.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/authorize.middleware.js';

const router = Router();

// ===============================================
// ==           RUTAS PÚBLICAS (GET)            ==
// ===============================================

// Obtener lista de comercios (con filtro opcional por categoría)
// GET /api/commerces  ||  GET /api/commerces?category=GASTRONOMIA
router.get('/commerces', getCommerces);

// Obtener un comercio específico por su ID
// GET /api/commerces/1
router.get('/commerces/:id', getCommerceById);

// ===============================================
// ==         RUTAS PROTEGIDAS                  ==
// ===============================================

// Crear un nuevo comercio
// POST /api/commerces
router.post('/commerces', authenticateToken, authorizeRole(['USER', 'ADMIN']), createCommerce);

// Obtener el comercio del usuario logueado
// GET /api/commerces/me
router.get('/commerces/me', authenticateToken, authorizeRole(['OWNER', 'ADMIN']), getMyCommerce);

// Actualizar el comercio del usuario logueado
// PUT /api/commerces/me
router.put('/commerces/me', authenticateToken, authorizeRole(['OWNER', 'ADMIN']), updateMyCommerce);

export default router;