import { Router } from 'express';
import { 
    createSubmission, 
    getSubmissions, 
    getMySubmissions, 
    replySubmission,
    updateSubmissionStatus
} from '../controllers/submission.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/authorize.middleware.js';

const router = Router();

// Crear sumission (Público o logueado)
// Para contactos no se requiere token, para otros sí. 
// El middleware se puede aplicar selectivamente.
router.post('/submissions', (req, res, next) => {
    // Si viene token, lo autenticamos, si no, lo dejamos pasar como anónimo
    const authHeader = req.headers['authorization'];
    if (authHeader) {
        return authenticateToken(req, res, next);
    }
    next();
}, createSubmission);

// Rutas protegidas
router.get('/submissions/me', authenticateToken, getMySubmissions);

// Rutas de administración
router.get('/submissions', authenticateToken, authorizeRole(['ADMIN']), getSubmissions);
router.patch('/submissions/:id/reply', authenticateToken, authorizeRole(['ADMIN']), replySubmission);
router.put('/submissions/:id/status', authenticateToken, authorizeRole(['ADMIN']), updateSubmissionStatus);

export default router;
