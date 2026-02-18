import prisma from '../db/prismaClient.js';

/**
 * Crea una nueva entrega/submission.
 */
export const createSubmissionModel = async (data) => {
    return prisma.submission.create({
        data: {
            ...data,
            userId: data.userId ? parseInt(data.userId) : null
        }
    });
};

/**
 * Obtiene todas las submissions (solo ADMIN).
 */
export const getAllSubmissionsModel = async () => {
    return prisma.submission.findMany({
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true } } }
    });
};

/**
 * Obtiene las submissions del usuario actual.
 */
export const getSubmissionsByUserIdModel = async (userId) => {
    return prisma.submission.findMany({
        where: { userId: parseInt(userId) },
        orderBy: { createdAt: 'desc' }
    });
};

/**
 * Actualiza el estado de una submission.
 */
export const updateSubmissionStatusModel = async (id, status, adminResponse = null) => {
    return prisma.submission.update({
        where: { id: parseInt(id) },
        data: { 
            status,
            ...(adminResponse && { adminResponse }),
            updatedAt: new Date()
        }
    });
};

/**
 * Obtiene una submission por ID.
 */
export const getSubmissionByIdModel = async (id) => {
    return prisma.submission.findUnique({
        where: { id: parseInt(id) },
        include: { user: true }
    });
};
