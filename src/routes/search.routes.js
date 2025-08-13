import { Router } from 'express';
import { searchGlobal } from '../controllers/search.controller.js';

const router = Router();

// Endpoint público para la búsqueda global
// Se accederá a él como: GET /api/search?q=termino_a_buscar
router.get('/search', searchGlobal);

export default router;