// src/utils/error.utils.js

/**
 * Crea y lanza un error con un mensaje y un código de estado HTTP.
 * @param {string} message - El mensaje de error.
 * @param {number} statusCode - El código de estado HTTP (ej. 404, 400, 403).
 * @param {object} [extras] - Props adicionales (requireCaptcha, isVerified, code…).
 */
export const throwError = (message, statusCode, extras = {}) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    Object.assign(error, extras);
    throw error;
};