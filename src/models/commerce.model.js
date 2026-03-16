import prisma from '../db/prismaClient.js';
import { moderateContent } from '../services/moderation.service.js';
import { throwError } from '../utils/error.utils.js';

// --- FUNCIONES HELPER PÚBLICAS ---

/**
 * Sanitizar URLs para asegurar que tengan http:// o https://
 */
const sanitizeUrl = (url) => {
    if (!url) return url;
    if (url.startsWith('javascript:')) return null;
    if (!/^https?:\/\//i.test(url)) {
        return `https://${url}`;
    }
    return url;
};

/**
 * Limitar array de imágenes según plan
 */
const enforceGalleryLimits = (images, planLevel) => {
    if (!images || !Array.isArray(images)) return [];
    if (planLevel <= 1) return images.slice(0, 1); // Free: 1 photo
    if (planLevel === 2) return images.slice(0, 10); // Plata: 10 photos
    return images; // Oro/Platino: Ilimitado (o límite técnico superior, ej 50)
};

// --- FUNCIONES PÚBLICAS (PARA CONSUMIDORES) ---

/**
 * Obtiene comercios activos, permitiendo filtrado por nivel de plan.
 * @param {number} planLevel - Opcional, nivel de plan a filtrar (1=Free, 2=Plata, 3=Oro, 4=Platino).
 * @returns {Promise<Array>} Lista de comercios.
 */
export const getAllCommercesModel = async (planLevel = null) => {
    return prisma.commerce.findMany({
        where: { 
            isActive: true,
            ...(planLevel && { planLevel: parseInt(planLevel) })
        },
        orderBy: [
            { planLevel: 'desc' },
            { name: 'asc' }
        ],
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
    // Ya no validamos contra una lista hardcodeada (categories),
    // permitimos que el sistema busque cualquier categoría dinámica.
    
    // Usamos la categoría en la consulta
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
            categories: true, // Incluimos info de las categorías múltiples vinculadas
            branches: true,   // Incluimos info de sus sucursales
            events: {
                where: { status: 'SCHEDULED' },
                orderBy: { startDate: 'asc' },
            },
            comments: {
                orderBy: { createdAt: 'desc' },
                include: {
                    user: { select: { name: true } }
                }
            }
        },
    });
    if (!commerce) {
        throwError('Commerce not found.', 404);
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
    // 1. Comprobar si el nombre del comercio ya existe.
    const existingCommerceByName = await prisma.commerce.findUnique({
        where: { name: data.name }
    });
    
    if (existingCommerceByName) {
        throwError('El nombre del comercio ya está en uso.', 409);
    }

    // Lógica para Múltiples Categorías y Niveles de Plan
    const finalPlanLevel = data.planLevel || 1;
    
    // 🛡️ AI GUARD: Analizar contenido antes de crear
    const textToAnalyze = `${data.name}\n${data.description}\n${data.shortDescription || ''}`;
    const moderationResult = await moderateContent(textToAnalyze, 'COMMERCE');

    if (!moderationResult.approved) {
        throwError(moderationResult.reason || 'Contenido rechazado por el sistema de moderación', 400);
    }

    // 0. Validar existencia de categorías para evitar P2025
    let categoryConnectOptions = {};
    if (data.categoryIds && data.categoryIds.length > 0) {
        // Limitar máximo según plan
        let limit = 1; // Free
        if (finalPlanLevel >= 2) limit = 3; // Plata o superior
        
        const selectedIds = data.categoryIds.slice(0, limit);
        const existingCategories = await prisma.category.findMany({
            where: { id: { in: selectedIds.map(id => parseInt(id)) } },
            select: { id: true, slug: true }
        });
        
        if (existingCategories.length > 0) {
            categoryConnectOptions = {
                connect: existingCategories.map(c => ({ id: c.id }))
            };
            // Sincronizar el Enum 'category' principal (retrocompatibilidad)
            if (!data.category) {
                data.category = existingCategories[0].slug;
            }
        }
    }

    return prisma.$transaction(async (tx) => {
        const newCommerce = await tx.commerce.create({
            data: {
                name: data.name,
                description: data.description,
                shortDescription: data.shortDescription,
                address: data.address,
                phone: data.phone,
                category: data.category || null, 
                galleryImages: enforceGalleryLimits(data.galleryImages, finalPlanLevel),
                website: sanitizeUrl(data.website),
                videoUrl: sanitizeUrl(data.videoUrl),
                externalLink: sanitizeUrl(data.externalLink),
                facebook: sanitizeUrl(data.facebook),
                instagram: sanitizeUrl(data.instagram),
                whatsapp: data.whatsapp,
                coverImage: data.coverImage,
                openingHours: data.openingHours, 
                latitude: data.latitude ? parseFloat(data.latitude) : null,
                longitude: data.longitude ? parseFloat(data.longitude) : null,
                ownerId,
                status: 'PENDING',
                planLevel: finalPlanLevel,
                isVerified: false,
                attributes: data.attributes ? (Array.isArray(data.attributes) ? data.attributes : JSON.parse(data.attributes)) : [], 
                categories: categoryConnectOptions
            },
            include: { categories: true }
        });

        // Crear la primera sucursal automáticamente
        await tx.branch.create({
            data: {
                commerceId: newCommerce.id,
                name: 'Casa Central',
                address: data.address,
                phone: data.phone,
                isMain: true
            }
        });

        if (moderationResult.requiresReview) {
            console.log(`⚠️ Comercio ${newCommerce.id} flagueado para revisión extra`);
        }

        return newCommerce;
    });
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
        include: { 
            events: true,
            categories: true,
            branches: true
        },
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
    const { ownerId: _, status, isVerified, planLevel, categoryIds, ...updateData } = data;

    // Si es ADMIN, sí podría permitirle cambiar status o planLevel si lo pasamos por aquí, 
    // pero por ahora mantenemos la lógica de negocio separada.
    
    // Aplicar límites y sanitización
    const planLevelFinal = userRole === 'ADMIN' && planLevel !== undefined ? parseInt(planLevel) : commerce.planLevel;
    if (updateData.galleryImages) {
        updateData.galleryImages = enforceGalleryLimits(updateData.galleryImages, planLevelFinal);
    }
    if (updateData.website !== undefined) updateData.website = sanitizeUrl(updateData.website);
    if (updateData.externalLink !== undefined) updateData.externalLink = sanitizeUrl(updateData.externalLink);
    if (updateData.instagram !== undefined) updateData.instagram = sanitizeUrl(updateData.instagram);
    if (updateData.facebook !== undefined) updateData.facebook = sanitizeUrl(updateData.facebook);

    // Lógica Categorías Múltiples (Si mandan 'categoryIds')
    let categoryUpdateOptions = undefined;
    if (categoryIds && Array.isArray(categoryIds)) {
        let limit = 1;
        if (planLevelFinal >= 2) limit = 3;
        const selectedIds = categoryIds.slice(0, limit);
        categoryUpdateOptions = {
            set: selectedIds.map(id => ({ id: Number(id) }))
        };
    }

    return prisma.commerce.update({
        where: { id: parseInt(id) },
        data: {
            ...(userRole === 'ADMIN' ? { 
                ...updateData, 
                status, 
                planLevel: planLevelFinal, 
                isVerified,
                category: updateData.category || undefined
            } : {
                ...updateData,
                category: updateData.category || undefined
            }),
            categories: categoryUpdateOptions
        }
    });
};

export const updateCommerceByOwnerModel = async (ownerId, data) => {
    try {
        // Excluimos campos que el dueño no debería poder cambiar directamente.
        const { ownerId: _, status, isVerified, planId, planLevel, categoryIds, ...updateData } = data;

        // Fetch current commerce to get planLevel
        const currentCommerce = await prisma.commerce.findFirst({ where: { ownerId } });
        if (!currentCommerce) throwError('Commerce for this owner not found.', 404);

        if (updateData.galleryImages) {
            updateData.galleryImages = enforceGalleryLimits(updateData.galleryImages, currentCommerce.planLevel);
        }
        if (updateData.website !== undefined) updateData.website = sanitizeUrl(updateData.website);
        if (updateData.externalLink !== undefined) updateData.externalLink = sanitizeUrl(updateData.externalLink);
        if (updateData.instagram !== undefined) updateData.instagram = sanitizeUrl(updateData.instagram);
        if (updateData.facebook !== undefined) updateData.facebook = sanitizeUrl(updateData.facebook);

        // Lógica de Categorías Múltiples Owner
        let categoryUpdateOptions = undefined;
        if (categoryIds && Array.isArray(categoryIds)) {
            let limit = 1;
            if (currentCommerce.planLevel >= 2) limit = 3;
            const selectedIds = categoryIds.slice(0, limit);
            categoryUpdateOptions = {
                set: selectedIds.map(id => ({ id: Number(id) }))
            };
        }

        return await prisma.commerce.update({
            where: { ownerId },
            data: {
               ...updateData,
               categories: categoryUpdateOptions
            },
        });
    } catch (error) {
        // P2025 es el código de error de Prisma para "registro no encontrado" en una actualización.
        if (error.code === 'P2025') {
            throwError('Commerce for this owner not found.', 404);
        }
        throw error; // Re-lanza otros errores.
    }
};
