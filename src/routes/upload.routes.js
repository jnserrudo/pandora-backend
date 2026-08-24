import { Router } from 'express';
import multer from 'multer';
import { uploadImageController } from '../controllers/upload.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    const err = new Error(
      'Tipo de archivo no válido. Se aceptan JPG, PNG, GIF o WebP (no HEIC).'
    );
    err.statusCode = 400;
    cb(err);
  },
});

const handleMulter = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          message: 'La imagen supera el tamaño máximo de 10 MB.',
        });
      }
      return res.status(400).json({ message: 'Error al recibir el archivo.' });
    }
    return res.status(err.statusCode || 400).json({
      message: err.message || 'Archivo no válido.',
    });
  });
};

router.post('/upload/image', authenticateToken, handleMulter, uploadImageController);

export default router;
