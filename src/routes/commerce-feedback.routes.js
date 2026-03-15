import { Router } from 'express';
import {
  createComment,
  getCommerceComments,
  markCommentAsRead,
  updateComment,
  deleteComment,
  createAdvisory,
  getCommerceAdvisories,
  updateAdvisoryStatus,
  getCommerceMetrics,
  getFeaturedCommerces,
  setCommerceFeatured,
  replyComment
} from '../controllers/commerce-feedback.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/authorize.middleware.js';

const router = Router();

// ========== COMENTARIOS ==========

// Público: Cualquiera puede comentar (logueado o no)
router.post('/commerces/:id/comments', createComment);

// Solo ADMIN: Ver comentarios de un comercio
router.get(
  '/commerces/:id/comments',
  authenticateToken,
  authorizeRole(['ADMIN']),
  getCommerceComments
);

// Solo ADMIN: Marcar comentario como leído
router.patch(
  '/comments/:id/read',
  authenticateToken,
  authorizeRole(['ADMIN']),
  markCommentAsRead
);

// Solo ADMIN: Actualizar notas internas de un comentario
router.patch(
  '/comments/:id',
  authenticateToken,
  authorizeRole(['ADMIN']),
  updateComment
);

// Solo ADMIN: Eliminar comentario
router.delete(
  '/comments/:id',
  authenticateToken,
  authorizeRole(['ADMIN']),
  deleteComment
);

// OWNER/ADMIN (Plan Plata+): Responder a un comentario
router.patch(
  '/comments/:id/reply',
  authenticateToken,
  authorizeRole(['OWNER', 'ADMIN']),
  replyComment
);

// ========== ASESORÍAS ==========

// Solo ADMIN: Crear asesoría para un comercio
router.post(
  '/commerces/:id/advisories',
  authenticateToken,
  authorizeRole(['ADMIN']),
  createAdvisory
);

// OWNER/ADMIN: Ver asesorías de un comercio
router.get(
  '/commerces/:id/advisories',
  authenticateToken,
  getCommerceAdvisories
);

// OWNER: Actualizar estado de asesoría (marcar como leída/implementada)
router.patch(
  '/advisories/:id/status',
  authenticateToken,
  updateAdvisoryStatus
);

// ========== MÉTRICAS ==========

// ADMIN: Obtener métricas de un comercio
router.get(
  '/commerces/:id/metrics',
  authenticateToken,
  authorizeRole(['ADMIN']),
  getCommerceMetrics
);

// ========== FEATURED COMMERCES ==========

// Público: Obtener comercios destacados
router.get('/commerces/featured', getFeaturedCommerces);

// Solo ADMIN: Marcar comercio como destacado
router.post(
  '/commerces/:id/featured',
  authenticateToken,
  authorizeRole(['ADMIN']),
  setCommerceFeatured
);

export default router;
