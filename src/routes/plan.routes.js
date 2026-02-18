import { Router } from 'express';
import { getPlans, updatePlan, getPaymentHistory } from '../controllers/plan.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/authorize.middleware.js';

const router = Router();

// Público: Ver planes
router.get('/plans', getPlans);

// Privado: Historial de pagos (ADMIN)
router.get('/plans/history', authenticateToken, authorizeRole(['ADMIN']), getPaymentHistory);

// Privado: Actualizar plan (ADMIN)
router.put('/plans/:id', authenticateToken, authorizeRole(['ADMIN']), updatePlan);

export default router;
