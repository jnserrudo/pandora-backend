import { Router } from 'express';
import { logSearch, getTopSearches } from '../controllers/search-analytics.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/authorize.middleware.js';

const router = Router();

// Público: Cualquiera puede loguear una búsqueda al usar el buscador
router.post('/log', logSearch);

// Privado: Solo Admin puede ver las estadísticas
router.get('/top', authenticateToken, authorizeRole(['ADMIN']), getTopSearches);

export default router;
