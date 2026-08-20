// src/utils/jwt.utils.js
import jwt from 'jsonwebtoken';
import jwtConfig from '../config/jwtConfig.js'; 

export const generateAccessToken = (payload) => {
  return jwt.sign(payload, jwtConfig.jwtSecret, { expiresIn: jwtConfig.jwtExpiresIn });
};

export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, jwtConfig.refreshTokenSecret, { expiresIn: jwtConfig.refreshTokenExpiresIn });
};

export const verifyAccessToken = (token) => {
  try {
    const payload = jwt.verify(token, jwtConfig.jwtSecret);
    return { valid: true, expired: false, payload };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { valid: false, expired: true, error };
    }
    return { valid: false, expired: false, error };
  }
};

export const verifyRefreshToken = (token) => {
  try {
    const payload = jwt.verify(token, jwtConfig.refreshTokenSecret);
    return { valid: true, expired: false, payload };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { valid: false, expired: true, error };
    }
    return { valid: false, expired: false, error };
  }
};
