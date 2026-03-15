import express from 'express';
import { getFAQsByCommerceId, createFAQ, updateFAQ, deleteFAQ } from '../controllers/faq.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Rutas Públicas
router.get('/commerces/:commerceId/faqs', getFAQsByCommerceId);

// Rutas Protegidas (Dueño del comercio con Plan Oro+)
router.post('/commerces/:commerceId/faqs', authenticateToken, createFAQ);
router.put('/commerces/:commerceId/faqs/:id', authenticateToken, updateFAQ);
router.delete('/commerces/:commerceId/faqs/:id', authenticateToken, deleteFAQ);

export default router;
