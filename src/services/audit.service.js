import prisma from '../db/prismaClient.js';

/**
 * Registra una acción en la auditoría del sistema.
 * 
 * @param {Object} params - Parámetros del log
 * @param {number|null} params.userId - ID del usuario que realiza la acción
 * @param {string} params.action - Acción realizada ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', etc.)
 * @param {string} params.resourceType - Tipo de entidad afectada ('COMMERCE', 'USER', 'ARTICLE', etc.)
 * @param {number|string} params.resourceId - ID de la entidad afectada
 * @param {Object|null} params.oldData - Snapshot de los datos ANTES de la acción
 * @param {Object|null} params.newData - Snapshot de los datos DESPUÉS de la acción
 * @param {string|null} params.ipAddress - Dirección IP del solicitante
 */
export const createLog = async ({
    userId,
    action,
    resourceType,
    resourceId,
    oldData = null,
    newData = null,
    ipAddress = null
}) => {
    try {
        // Sanitizar datos sensibles (ej. contraseñas) antes de guardar
        const sanitize = (data) => {
            if (!data) return null;
            const clean = { ...data };
            const sensitiveKeys = ['password', 'token', 'refreshToken', 'secret'];
            sensitiveKeys.forEach(key => delete clean[key]);
            return clean;
        };

        const log = await prisma.auditLog.create({
            data: {
                userId: userId ? parseInt(userId) : null,
                action: action.toUpperCase(),
                resourceType: resourceType.toUpperCase(),
                resourceId: resourceId ? parseInt(resourceId) : null,
                oldData: sanitize(oldData),
                newData: sanitize(newData),
                ipAddress
            }
        });
        return log;
    } catch (error) {
        // Fallback silencioso para no romper la transacción principal si la auditoría falla
        console.error("Critical: Error saving to AuditLog:", error);
        return null;
    }
};
