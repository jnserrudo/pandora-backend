import { Router } from 'express';
import { getMyProfile, updateMyProfile } from '../controllers/user.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

// ===============================================
// ==     RUTAS PROTEGIDAS PARA PERFIL DE USUARIO ==
// ===============================================

// Obtener el perfil del usuario logueado
// GET /api/users/me
router.get('/users/me', authenticateToken, getMyProfile);

// Actualizar el perfil del usuario logueado
// PUT /api/users/me
router.put('/users/me', authenticateToken, updateMyProfile);

export default router;