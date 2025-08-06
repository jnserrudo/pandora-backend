import { Router } from 'express';
import { getCurrentUser, updateCurrentUser } from '../controllers/user.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
const router = Router();
router.get('/users/me', authenticateToken, getCurrentUser);
router.put('/users/me', authenticateToken, updateCurrentUser);
export default router;