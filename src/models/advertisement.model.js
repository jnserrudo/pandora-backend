import prisma from '../db/prismaClient.js';

export const getAllAdvertisementsModel = async (filters) => {
    const { category, position, isActive } = filters;
    const where = {
        ...(category && { category }),
        ...(position && { position }),
        ...(isActive !== undefined && { isActive: isActive === 'true' }), // Convertir string 'true'/'false'
        startDate: { lte: new Date() },
        endDate: { gte: new Date() }
    };

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

export const getAdvertisementByIdModel = async (id) => {
    return await prisma.advertisement.findUnique({
        where: { id: parseInt(id) },
        include: {
            commerce: {
                select: { id: true, name: true }
            }
        }
    });
};

export const createAdvertisementModel = async (data) => {
    // Convertir fechas string a Date objects si es necesario (Prisma suele manejarlo, pero mejor asegurar)
    const { startDate, endDate, commerceId, ...rest } = data;
    
    return await prisma.advertisement.create({
        data: {
            ...rest,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            ...(commerceId && { commerceId: parseInt(commerceId) })
        }
    });
};

export const updateAdvertisementModel = async (id, data) => {
    const { startDate, endDate, commerceId, ...rest } = data;
    const updateData = { ...rest };
    
    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = new Date(endDate);
    if (commerceId) updateData.commerceId = parseInt(commerceId);

    return await prisma.advertisement.update({
        where: { id: parseInt(id) },
        data: updateData
    });
};

export const deleteAdvertisementModel = async (id) => {
    return await prisma.advertisement.delete({
        where: { id: parseInt(id) }
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
