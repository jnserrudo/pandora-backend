import { Router } from 'express';
import { getCoupons, createCoupon, deleteCoupon, validateCoupon, updateCoupon } from '../controllers/coupon.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/authorize.middleware.js';

const router = Router();

// Público (logueado): Validar cupón antes de comprar
router.post('/coupons/validate', authenticateToken, validateCoupon);

// Privado: Gestión de cupones (ADMIN)
router.get('/coupons', authenticateToken, authorizeRole(['ADMIN']), getCoupons);
router.post('/coupons', authenticateToken, authorizeRole(['ADMIN']), createCoupon);
router.patch('/coupons/:id', authenticateToken, authorizeRole(['ADMIN']), updateCoupon);
router.delete('/coupons/:id', authenticateToken, authorizeRole(['ADMIN']), deleteCoupon);

export default router;
