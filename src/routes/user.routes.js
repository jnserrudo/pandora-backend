import { Router } from 'express';
import { 
    getMyProfile, 
    updateMyProfile,
    getAllUsers,
    getUserById,
    getUserContent
} from '../controllers/user.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/authorize.middleware.js';

const router = Router();

// ===============================================
// ==     RUTAS PROTEGIDAS PARA PERFIL DE USUARIO ==
// ===============================================

// Obtener el perfil del usuario logueado (DEBE IR ANTES DE /users/:id)
// GET /api/users/me
router.get('/users/me', authenticateToken, getMyProfile);

// Actualizar el perfil del usuario logueado
// PUT /api/users/me
router.put('/users/me', authenticateToken, updateMyProfile);

// ===============================================
// ==     RUTAS DE ADMINISTRACIÓN (ADMIN)       ==
// ===============================================

// Obtener todos los usuarios (con búsqueda opcional)
// GET /api/users?search=nombre
router.get('/users', authenticateToken, authorizeRole(['ADMIN']), getAllUsers);

// Obtener contenido de un usuario (eventos, comercios) (DEBE IR ANTES DE /users/:id)
// GET /api/users/:id/content
router.get('/users/:id/content', authenticateToken, authorizeRole(['ADMIN']), getUserContent);

// Obtener un usuario por ID (DEBE IR AL FINAL)
// GET /api/users/:id
router.get('/users/:id', authenticateToken, authorizeRole(['ADMIN']), getUserById);

export default router;