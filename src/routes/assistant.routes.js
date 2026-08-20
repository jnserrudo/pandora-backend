import { Router } from 'express';
import { postAssistantChat } from '../controllers/assistant.controller.js';
import { optionalAuthenticate } from '../middlewares/auth.middleware.js';
import { assistantLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

router.post('/assistant', optionalAuthenticate, assistantLimiter, postAssistantChat);

export default router;
