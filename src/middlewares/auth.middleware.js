// src/middlewares/auth.middleware.js
import { verifyAccessToken } from '../utils/jwt.utils.js';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extract token from "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ message: 'Se requiere el Access Token.' });
  }

  const result = verifyAccessToken(token);

  if (!result.valid) {
    const message = result.expired
      ? 'El Access Token ha expirado.'
      : 'El Access Token no es válido.';
    return res.status(401).json({ message });
  }

  req.user = result.payload;
  next();
};

/** Si hay Bearer, autentica; si no, sigue como anónimo. */
export const optionalAuthenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return next();
  return authenticateToken(req, res, next);
};

