import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import * as aiController from '../controllers/ai.controller.js';
import { seedTestUsers } from '../controllers/user-seed.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/authorize.middleware.js';

const router = Router();
const adminOnly = [authenticateToken, authorizeRole(['ADMIN'])];

router.get('/stats', ...adminOnly, adminController.getAdminStats);
router.post('/seed-users', ...adminOnly, seedTestUsers);

router.get('/ai/status', ...adminOnly, aiController.getAiStatus);
router.post('/ai/chat', ...adminOnly, aiController.postAiChat);
router.get('/moderation/stats', ...adminOnly, aiController.getModerationStats);
router.get('/moderation/flagged', ...adminOnly, aiController.getFlaggedModeration);
router.get('/moderation/logs', ...adminOnly, aiController.getModerationLogs);
router.patch('/moderation/:id/review', ...adminOnly, aiController.reviewModeration);

export default router;
