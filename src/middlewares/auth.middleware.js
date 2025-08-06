// src/middlewares/auth.middleware.js
import { verifyAccessToken } from '../utils/jwt.utils.js';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extract token from "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ message: 'Access Token required.' });
  }

  const decoded = verifyAccessToken(token);

  if (!decoded) {
    return res.status(403).json({ message: 'Invalid or expired Access Token.' });
  }

  req.user = decoded; // Attach user information to the request object
  next(); // Proceed to the next middleware/controller
};

