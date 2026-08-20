import { Router } from 'express';
import { toggleFavorite, getMyFavorites } from '../controllers/favorite.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/favorites/toggle', authenticateToken, toggleFavorite);
router.get('/favorites/me', authenticateToken, getMyFavorites);

export default router;
