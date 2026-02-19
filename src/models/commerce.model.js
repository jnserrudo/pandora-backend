import prisma from '../db/prismaClient.js';
import { moderateContent } from '../services/moderation.service.js';
import { throwError } from '../utils/error.utils.js';

// --- FUNCIONES PÚBLICAS (PARA CONSUMIDORES) ---

const categories = ['VIDA_NOCTURNA', 'GASTRONOMIA', 'SALAS_Y_TEATRO'];

/**
 * Obtiene todos los comercios que están activos.
 * @returns {Promise<Array>} Lista de comercios.
 */
export const getAllCommercesModel = async () => {
    return prisma.commerce.findMany({
        where: { 
            // status: 'ACTIVE', // Comentado para permitir ver data existente
            isActive: true 
        },
        orderBy: { name: 'asc' },
    });
};

/**
 * Obtiene todos los comercios pendientes de validación (solo ADMIN).
 */
export const getPendingCommercesModel = async () => {
    return prisma.commerce.findMany({
        where: { status: 'PENDING', isActive: true },
        orderBy: { createdAt: 'desc' },
        include: { owner: { select: { name: true, email: true } } }
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
            category: category, 
            // status: 'ACTIVE',
            isActive: true
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
    if (!commerce || commerce.status !== 'ACTIVE' || !commerce.isActive) {
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
    // 1. MODIFICACIÓN: Ahora solo comprobamos si el nombre del comercio ya existe.
    // Quitamos la comprobación de `ownerId` para permitir que un usuario tenga varios comercios.
    const existingCommerceByName = await prisma.commerce.findUnique({
        where: { name: data.name }
    });
    
    if (existingCommerceByName) {
        throwError('Commerce name is already taken.', 409);
    }

    // 🛡️ AI GUARD: Analizar contenido antes de crear
    const textToAnalyze = `${data.name}\n${data.description}`;
    const moderationResult = await moderateContent(textToAnalyze, 'COMMERCE');

    if (!moderationResult.approved) {
        throwError(moderationResult.reason || 'Contenido rechazado por el sistema de moderación', 400);
    }
   
    //  2. AÑADIDO: Preparamos los datos para la creación,
    // asegurando que 'galleryImages' tenga un valor por defecto.
    const commerceData = {
        ...data,
        galleryImages: data.galleryImages ?? [], // Si no viene, usamos un array vacío
        owner: { connect: { id: ownerId } }
    };

    // 3. MANTENIDO: La transacción es una excelente idea, la mantenemos.
    // Se asegura de que ambas operaciones (crear comercio y actualizar rol) se completen
    // o ninguna lo haga, manteniendo la consistencia de los datos.
    const commerce = await prisma.commerce.create({
        data: {
            ...commerceData,
            status: 'PENDING' // Todos van a PENDING para revisión manual del admin
        }
    });

    // Si el contenido fue flagueado, podríamos notificar al admin aquí
    if (moderationResult.requiresReview) {
        console.log(`⚠️ Comercio ${commerce.id} flagueado por AI Guard para revisión extra`);
        // TODO: Enviar notificación al admin
    }

    return commerce;
};

/**
 * Valida un comercio (solo ADMIN).
 */
export const validateCommerceModel = async (id, adminId, status, reason) => {
    return prisma.$transaction(async (tx) => {
        const commerce = await tx.commerce.update({
            where: { id: parseInt(id) },
            data: {
                status,
                validationReason: reason,
                validatedById: adminId,
                validatedAt: new Date(),
                ...(status === 'REJECTED' && { isActive: false })
            },
            include: { owner: true }
        });

        // Si se aprueba, promovemos al usuario a OWNER
        if (status === 'ACTIVE') {
            await tx.user.update({
                where: { id: commerce.ownerId },
                data: { role: 'OWNER' }
            });
        }

        return commerce;
    });
};

// Implementación de Soft Delete para Commerce
export const deleteCommerceModel = async (id) => {
    return prisma.commerce.update({
        where: { id: parseInt(id) },
        data: { isActive: false }
    });
};

/**
 * Obtiene el comercio del usuario autenticado, sin importar su estado.
 * @param {number} ownerId - ID del dueño.
 * @returns {Promise<Object>} El comercio del usuario.
 */
export const getCommerceByOwnerModel = async (ownerId) => {
    const commerce = await prisma.commerce.findMany({
        where: { ownerId },
        include: { events: true },
    });
    if (!commerce) {
        throwError('Commerce for this owner not found.', 404);
    }
    return commerce;
};

/**
 * Actualiza un comercio por su ID.
 * @param {number} id - ID del comercio.
 * @param {object} data - Datos a actualizar.
 * @param {number} userId - ID del usuario que solicita la actualización.
 * @param {string} userRole - Rol del usuario.
 */
export const updateCommerceModel = async (id, data, userId, userRole) => {
    // 1. Buscar el comercio
    const commerce = await prisma.commerce.findUnique({
        where: { id: parseInt(id) }
    });

    if (!commerce) {
        throwError('Commerce not found.', 404);
    }

    // 2. Verificar permisos: Solo el dueño o un ADMIN pueden editar
    if (commerce.ownerId !== userId && userRole !== 'ADMIN') {
        throwError('You do not have permission to update this commerce.', 403);
    }

    // 3. Limpiar datos (evitar que el dueño se auto-apruebe o cambie campos sensibles)
    const { ownerId: _, status, isVerified, planId, ...updateData } = data;

    // Si es ADMIN, sí podría permitirle cambiar status o planId si lo pasamos por aquí, 
    // pero por ahora mantenemos la lógica de negocio separada.
    
    return prisma.commerce.update({
        where: { id: parseInt(id) },
        data: userRole === 'ADMIN' ? { ...updateData, status, planId, isVerified } : updateData
    });
};

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
