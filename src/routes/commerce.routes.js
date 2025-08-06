import { Router } from 'express';
import { createCommerce, getMyCommerce, updateMyCommerce, getCommerceById } from '../controllers/commerce.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/authorize.middleware.js';
const router = Router();
router.get('/commerces/:id', getCommerceById); // Ruta pública
router.post('/commerces', authenticateToken, authorizeRole(['USER', 'ADMIN']), createCommerce);
router.get('/commerces/me', authenticateToken, authorizeRole(['OWNER', 'ADMIN']), getMyCommerce);
router.put('/commerces/me', authenticateToken, authorizeRole(['OWNER', 'ADMIN']), updateMyCommerce);
export default router;