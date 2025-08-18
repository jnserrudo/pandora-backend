import { Router } from 'express';
import multer from 'multer';
import { uploadImageController } from '../controllers/upload.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js'; 

const router = Router();
const upload = multer({ storage: multer.memoryStorage() }); 

// Ruta para subir una sola imagen, requiere autenticación
router.post('/upload/image', authenticateToken, upload.single('image'), uploadImageController);

export default router;