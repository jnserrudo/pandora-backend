import { Router } from 'express';
import {
    getAdvertisements,
    getAdvertisementById,
    createAdvertisement,
    updateAdvertisement,
    deleteAdvertisement,
    trackAdvertisement
} from '../controllers/advertisement.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/authorize.middleware.js';

const router = Router();

// Public Routes
router.get('/advertisements', getAdvertisements);
router.get('/advertisements/:id', getAdvertisementById);
router.post('/advertisements/:id/track', trackAdvertisement); // Public tracking

// Admin Routes
router.post(
    '/advertisements', 
    authenticateToken, 
    authorizeRole(['ADMIN']), 
    createAdvertisement
);

router.put(
    '/advertisements/:id', 
    authenticateToken, 
    authorizeRole(['ADMIN']), 
    updateAdvertisement
);

router.delete(
    '/advertisements/:id', 
    authenticateToken, 
    authorizeRole(['ADMIN']), 
    deleteAdvertisement
);

export default router;
