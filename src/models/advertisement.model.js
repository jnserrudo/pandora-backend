import prisma from '../db/prismaClient.js';

// Para el ADMIN queremos ver TODAS las publicidades sin filtros de fecha
// Para el PÚBLICO queremos filtrar por activas y vigencia
export const getAllAdvertisementsModel = async (filters, adminMode = false) => {
    const { category, position, isActive } = filters;

    let where = {};

    // Filtros de categoría y posición (aplican siempre)
    if (category) where.category = category;
    if (position) where.position = position;

    if (adminMode) {
        // ADMIN: ve ABSOLUTAMENTE TODAS las publicidades
        // Sin filtro de isActive, sin filtro de fechas.
        // Puede estar vencida, inactiva, futura — el admin siempre la ve.
        if (isActive !== undefined) {
            where.isActive = isActive === 'true' || isActive === true;
        }
        // Sin filtros de fecha en adminMode
    } else {
        // PÚBLICO: solo activas y vigentes ahora mismo
        const now = new Date();
        where.isActive = true;
        where.startDate = { lte: now };
        // Ads sin endDate son siempre vigentes
        where.OR = [
            { endDate: null },
            { endDate: { gte: now } }
        ];
    }

    return await prisma.advertisement.findMany({
        where,
        include: {
            commerce: {
                select: { id: true, name: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
};

export const getAdvertisementByIdModel = async (id, adminMode = false) => {
    const ad = await prisma.advertisement.findUnique({
        where: { id: parseInt(id) },
        include: {
            commerce: {
                select: { id: true, name: true }
            }
        }
    });

    if (!ad) {
        throw Error('Advertisement not found');
    }

    // Solo restringir acceso público a publicidades inactivas
    if (!adminMode && !ad.isActive) {
        throw Error('Advertisement not found or inactive');
    }

    return ad;
};

export const createAdvertisementModel = async (data) => {
    const { startDate, endDate, commerceId, ...rest } = data;
    
    return await prisma.advertisement.create({
        data: {
            ...rest,
            startDate: new Date(startDate),
            // endDate es opcional: solo convertir si no es null/undefined/""
            ...(endDate ? { endDate: new Date(endDate) } : {}),
            ...(commerceId ? { commerceId: parseInt(commerceId) } : {})
        }
    });
};

export const updateAdvertisementModel = async (id, data) => {
    const { startDate, endDate, commerceId, ...rest } = data;
    const updateData = { ...rest };
    
    if (startDate) updateData.startDate = new Date(startDate);
    // Permitir borrar la fecha de fin enviando null explícitamente
    if (endDate !== undefined) {
        updateData.endDate = endDate ? new Date(endDate) : null;
    }
    if (commerceId) updateData.commerceId = parseInt(commerceId);
    // Limpiar relación si commerceId es null
    if (commerceId === null || commerceId === '' || commerceId === 0) {
        updateData.commerceId = null;
    }

    return await prisma.advertisement.update({
        where: { id: parseInt(id) },
        data: updateData
    });
};

export const deleteAdvertisementModel = async (id) => {
    return await prisma.advertisement.update({
        where: { id: parseInt(id) },
        data: { isActive: false }
    });
};

export const trackAdvertisementModel = async (id, type) => {
    const data = type === 'impression' 
        ? { impressions: { increment: 1 } }
        : { clicks: { increment: 1 } };
        
    return await prisma.advertisement.update({
        where: { id: parseInt(id) },
        data
    });
};
