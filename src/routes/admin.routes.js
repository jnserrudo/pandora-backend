import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { seedTestUsers } from '../controllers/user-seed.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/authorize.middleware.js';

const router = Router();

router.get('/stats', authenticateToken, authorizeRole(['ADMIN']), adminController.getAdminStats);
router.post('/seed-users', authenticateToken, authorizeRole(['ADMIN']), seedTestUsers);

export default router;
