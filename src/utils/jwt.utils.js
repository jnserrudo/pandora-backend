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
    return jwt.verify(token, jwtConfig.jwtSecret);
  } catch (error) {
    return null; // Token is invalid or expired
  }
};

export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, jwtConfig.refreshTokenSecret);
  } catch (error) {
    return null; // Token is invalid or expired
  }
};
