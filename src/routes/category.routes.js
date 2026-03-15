import { Router } from 'express';
import {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory
} from '../controllers/category.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/authorize.middleware.js';

const router = Router();

// Rutas Públicas
router.get('/', getCategories);

// Rutas Protegidas (SÓLO ADMIN)
router.post('/', authenticateToken, authorizeRole(['ADMIN']), createCategory);
router.put('/:id', authenticateToken, authorizeRole(['ADMIN']), updateCategory);
router.delete('/:id', authenticateToken, authorizeRole(['ADMIN']), deleteCategory);

export default router;
