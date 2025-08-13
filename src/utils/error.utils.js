// src/utils/error.utils.js

/**
 * Crea y lanza un error con un mensaje y un código de estado HTTP.
 * @param {string} message - El mensaje de error.
 * @param {number} statusCode - El código de estado HTTP (ej. 404, 400, 403).
 */
export const throwError = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
};