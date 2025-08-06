// src/routes/auth.routes.js
import { Router } from 'express';
import { registerUser, loginUser, refreshAccessToken, logoutUser } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js' 

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/refresh-token', refreshAccessToken);
router.post('/logout', authenticateToken, logoutUser); // Logout requires authentication

export default router;