import { Router } from 'express';
import {
  getCategories,
  createCategory,
  updateCategory,
  updateHomeCategories,
  deleteCategory,
} from '../controllers/category.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/authorize.middleware.js';

const router = Router();

// Públicas
router.get('/', getCategories);

// Admin — home-config ANTES de /:id
router.put(
  '/home-config',
  authenticateToken,
  authorizeRole(['ADMIN']),
  updateHomeCategories
);
router.post('/', authenticateToken, authorizeRole(['ADMIN']), createCategory);
router.put('/:id', authenticateToken, authorizeRole(['ADMIN']), updateCategory);
router.delete('/:id', authenticateToken, authorizeRole(['ADMIN']), deleteCategory);

export default router;
