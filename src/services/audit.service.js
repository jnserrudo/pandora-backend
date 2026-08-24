import prisma from '../db/prismaClient.js';

/**
 * Resuelve el origen del cliente desde headers (X-Client-Platform) o User-Agent.
 * @returns {'WEB'|'MOBILE'|'UNKNOWN'}
 */
export const resolveClientSource = (req) => {
    if (!req) return 'UNKNOWN';
    const header =
        req.headers?.['x-client-platform'] ||
        req.headers?.['X-Client-Platform'] ||
        (typeof req.get === 'function' ? req.get('x-client-platform') : null) ||
        '';
    const raw = String(header).trim().toLowerCase();
    if (raw === 'mobile' || raw === 'app' || raw === 'flutter' || raw === 'android' || raw === 'ios') {
        return 'MOBILE';
    }
    if (raw === 'web' || raw === 'browser') {
        return 'WEB';
    }
    const ua = String(req.headers?.['user-agent'] || '').toLowerCase();
    if (ua.includes('dart') || ua.includes('flutter') || ua.includes('okhttp')) {
        return 'MOBILE';
    }
    if (ua) return 'WEB';
    return 'UNKNOWN';
};

/**
 * Registra una acción en la auditoría del sistema.
 *
 * @param {Object} params
 * @param {import('express').Request} [params.req] - Si se pasa, rellena ipAddress y clientSource
 */
export const createLog = async ({
    userId,
    action,
    resourceType,
    resourceId,
    oldData = null,
    newData = null,
    ipAddress = null,
    clientSource = null,
    req = null,
}) => {
    try {
        const sanitize = (data) => {
            if (!data) return null;
            const clean = { ...data };
            const sensitiveKeys = ['password', 'token', 'refreshToken', 'secret'];
            sensitiveKeys.forEach((key) => delete clean[key]);
            return clean;
        };

        const resolvedIp = ipAddress ?? req?.ip ?? null;
        const resolvedSource = String(
            clientSource || resolveClientSource(req) || 'UNKNOWN'
        ).toUpperCase();

        const log = await prisma.auditLog.create({
            data: {
                userId: userId ? parseInt(userId) : null,
                action: action.toUpperCase(),
                resourceType: resourceType.toUpperCase(),
                resourceId: resourceId ? parseInt(resourceId) : null,
                oldData: sanitize(oldData),
                newData: sanitize(newData),
                ipAddress: resolvedIp,
                clientSource: resolvedSource,
            },
        });
        return log;
    } catch (error) {
        console.error('[AUDIT] Error crítico guardando log de auditoría:', error.message);
        return null;
    }
};
