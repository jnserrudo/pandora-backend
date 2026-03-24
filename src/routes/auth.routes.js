// src/routes/auth.routes.js
import { Router } from 'express';
import { registerUser, loginUser, refreshAccessToken, logoutUser, verifyOTP } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);
router.post('/verify-otp', authLimiter, verifyOTP);
router.post('/refresh-token', refreshAccessToken);
router.post('/logout', authenticateToken, logoutUser);

export default router;