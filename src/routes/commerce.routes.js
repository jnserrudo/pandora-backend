// commerce.routes.js

import { Router } from 'express';
import {
    getCommerces,
    getCommerceById,
    createCommerce,
    getMyCommerce,
    updateCommerce,
    updateMyCommerce,
    validateCommerce,
    getPendingCommerces,
} from '../controllers/commerce.controller.js';
import { getProductsByCommerceId, createProduct, deleteProduct } from '../controllers/product.controller.js';
import { getFAQsByCommerceId, createFAQ } from '../controllers/faq.controller.js';
import { getBranchesByCommerceId, createBranch, deleteBranch } from '../controllers/branch.controller.js';
import { subscribeNewsletter, getSubscriptions } from '../controllers/newsletter.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/authorize.middleware.js';

const router = Router();

// ===============================================
// ==           RUTAS PÚBLICAS                  ==
// ===============================================

// Obtener lista de todos los comercios activos.
// GET /api/commerces
router.get('/commerces', getCommerces);

// ===============================================
// ==           RUTAS PROTEGIDAS                ==
// ===============================================

// Obtener el comercio del usuario logueado.
// NOTA: Esta ruta debe ir ANTES que la ruta genérica con :id.
// GET /api/commerces/me
router.get('/commerces/me', authenticateToken, authorizeRole(['USER', 'OWNER', 'ADMIN']), getMyCommerce);

// Obtener comercios pendientes (SOLO ADMIN)
// GET /api/commerces/pending
router.get('/commerces/pending', authenticateToken, authorizeRole(['ADMIN']), getPendingCommerces);

// Actualizar el comercio del usuario logueado.
// PUT /api/commerces/me
router.put('/commerces/me', authenticateToken, authorizeRole(['OWNER', 'ADMIN']), updateMyCommerce);

// Actualizar un comercio específico por su ID.
// PUT /api/commerces/:id
router.put('/commerces/:id', authenticateToken, authorizeRole(['OWNER', 'ADMIN']), updateCommerce);

// Crear un nuevo comercio.
// POST /api/commerces
router.post('/commerces', authenticateToken, authorizeRole(['USER', 'OWNER', 'ADMIN']), createCommerce);

// Validar comercio (SOLO ADMIN)
// PUT /api/commerces/:id/validate
router.put('/commerces/:id/validate', authenticateToken, authorizeRole(['ADMIN']), validateCommerce);


// ===============================================
// ==           RUTA GENÉRICA PÚBLICA           ==
// ===============================================

// Obtener un comercio específico por su ID.
// Esta ruta es la más genérica y debe ir ÚLTIMA para que no intercepte a las demás.
// GET /api/commerces/1
router.get('/commerces/:id', getCommerceById);

// --- PRODUCTOS ---
router.get('/commerces/:commerceId/products', getProductsByCommerceId);
router.post('/commerces/:commerceId/products', authenticateToken, authorizeRole(['OWNER', 'ADMIN']), createProduct);
router.delete('/products/:id', authenticateToken, authorizeRole(['OWNER', 'ADMIN']), deleteProduct);

// --- FAQS ---
router.get('/commerces/:commerceId/faqs', getFAQsByCommerceId);
router.post('/commerces/:commerceId/faqs', authenticateToken, authorizeRole(['OWNER', 'ADMIN']), createFAQ);

// --- SUCURSALES ---
router.get('/commerces/:commerceId/branches', getBranchesByCommerceId);
router.post('/commerces/:commerceId/branches', authenticateToken, authorizeRole(['OWNER', 'ADMIN']), createBranch);
router.delete('/branches/:id', authenticateToken, authorizeRole(['OWNER', 'ADMIN']), deleteBranch);

// --- NEWSLETTER ---
router.post('/newsletter/subscribe', subscribeNewsletter);
router.get('/newsletter/subscriptions', authenticateToken, authorizeRole(['ADMIN']), getSubscriptions);

export default router;