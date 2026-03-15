import { Router } from 'express';
import { getAuditLogs, getAuditLogById } from '../controllers/audit.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/authorize.middleware.js';

const router = Router();

// Todas las rutas de auditoría requieren ser ADMIN
router.use(authenticateToken, authorizeRole(['ADMIN']));

router.get('/', getAuditLogs);
router.get('/:id', getAuditLogById);

export default router;
