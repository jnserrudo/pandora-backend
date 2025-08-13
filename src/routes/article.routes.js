import { Router } from 'express';
import {
    getArticles,
    getArticleBySlug,
    createArticle,
    updateArticle,
    deleteArticle,
} from '../controllers/article.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/authorize.middleware.js';

const router = Router();

// ===============================================
// ==           RUTAS PÚBLICAS (GET)            ==
// ===============================================

// Obtener la lista de todos los artículos publicados (Pandora Magazine)
// GET /api/articles
router.get('/articles', getArticles);

// Obtener un artículo específico por su slug (para leerlo)
// GET /api/articles/mi-primer-articulo
router.get('/articles/:slug', getArticleBySlug);


// ===============================================
// ==         RUTAS PROTEGIDAS (PARA ADMINS)    ==
// ===============================================

// Crear un nuevo artículo (requiere ser ADMIN)
// POST /api/articles
router.post('/articles', authenticateToken, authorizeRole(['ADMIN']), createArticle);

// Actualizar un artículo (requiere ser ADMIN)
// PUT /api/articles/1
router.put('/articles/:id', authenticateToken, authorizeRole(['ADMIN']), updateArticle);

// Eliminar un artículo (requiere ser ADMIN)
// DELETE /api/articles/1
router.delete('/articles/:id', authenticateToken, authorizeRole(['ADMIN']), deleteArticle);

export default router;