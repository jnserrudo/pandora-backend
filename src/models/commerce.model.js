import prisma from '../db/prismaClient.js';
import { throwError } from '../utils/error.utils.js';

// --- FUNCIONES PÚBLICAS (PARA CONSUMIDORES) ---

const categories = ['VIDA_NOCTURNA', 'GASTRONOMIA', 'SALAS_Y_TEATRO'];

/**
 * Obtiene todos los comercios que están activos.
 * @returns {Promise<Array>} Lista de comercios.
 */
export const getAllCommercesModel = async () => {
    return prisma.commerce.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { name: 'asc' },
    });
};

/**
 * Obtiene comercios activos filtrados por categoría.
 * @param {string} category - La categoría a filtrar (ej. 'GASTRONOMIA').
 * @returns {Promise<Array>} Lista de comercios filtrados.
 */


export const getCommercesByCategoryModel = async (category) => {
    // La validación se mantiene, pero nos aseguramos de que el input no tenga espacios extra
    if (!categories.includes(category)) {
        // Este error ya no debería ocurrir, pero es una buena salvaguarda.
        throwError('Invalid category provided.', 400);
    }
    
    // Usamos la variable limpia en la consulta
    return prisma.commerce.findMany({
        where: { 
            category: category, // Prisma manejará el enum correctamente
            status: 'ACTIVE' 
        },
        orderBy: { name: 'asc' },
    });
};
/**
 * Obtiene un solo comercio activo por su ID, incluyendo sus eventos programados.
 * @param {number} id - El ID del comercio.
 * @returns {Promise<Object>} El objeto del comercio.
 */
export const getCommerceByIdModel = async (id) => {
    const commerce = await prisma.commerce.findUnique({
        where: { id: parseInt(id) },
        include: {
            events: {
                where: { status: 'SCHEDULED' },
                orderBy: { startDate: 'asc' },
            },
        },
    });
    if (!commerce || commerce.status !== 'ACTIVE') {
        throwError('Commerce not found or is not active.', 404);
    }
    return commerce;
};

// --- FUNCIONES PROTEGIDAS (PARA OWNERS/ADMINS) ---

/**
 * Crea un nuevo comercio para un usuario y lo promueve a OWNER.
 * @param {object} data - Datos del comercio desde el body.
 * @param {number} ownerId - ID del usuario que será el dueño.
 * @returns {Promise<Object>} El nuevo comercio creado.
 */
export const createCommerceModel = async (data, ownerId) => {
    const existingCommerce = await prisma.commerce.findFirst({
        where: { OR: [{ ownerId }, { name: data.name }] }
    });
    if (existingCommerce) {
        const msg = existingCommerce.ownerId === ownerId ? 'User already owns a commerce.' : 'Commerce name is already taken.';
        throwError(msg, 409);
    }
    
    const [commerce, _] = await prisma.$transaction([
        prisma.commerce.create({
            data: { ...data, owner: { connect: { id: ownerId } } }
        }),
        prisma.user.update({
            where: { id: ownerId },
            data: { role: 'OWNER' }
        })
    ]);
    return commerce;
};

/**
 * Obtiene el comercio del usuario autenticado, sin importar su estado.
 * @param {number} ownerId - ID del dueño.
 * @returns {Promise<Object>} El comercio del usuario.
 */
export const getCommerceByOwnerModel = async (ownerId) => {
    const commerce = await prisma.commerce.findUnique({
        where: { ownerId },
        include: { events: true },
    });
    if (!commerce) {
        throwError('Commerce for this owner not found.', 404);
    }
    return commerce;
};

/**
 * Actualiza el comercio del usuario autenticado.
 * @param {number} ownerId - ID del dueño.
 * @param {object} data - Datos a actualizar.
 * @returns {Promise<Object>} El comercio actualizado.
 */
export const updateCommerceByOwnerModel = async (ownerId, data) => {
    try {
        // Excluimos campos que el dueño no debería poder cambiar directamente.
        const { ownerId: _, status, isVerified, ...updateData } = data;

        return await prisma.commerce.update({
            where: { ownerId },
            data: updateData,
        });
    } catch (error) {
        // P2025 es el código de error de Prisma para "registro no encontrado" en una actualización.
        if (error.code === 'P2025') {
            throwError('Commerce for this owner not found.', 404);
        }
        throw error; // Re-lanza otros errores.
    }
};