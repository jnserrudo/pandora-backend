import prisma from '../db/prismaClient.js';

const throwError = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
};

export const createEventModel = async (data, userId) => {
    const { commerceId } = data;
    const commerce = await prisma.commerce.findUnique({ where: { id: parseInt(commerceId) } });
    if (!commerce) throwError('Commerce not found.', 404);
    if (commerce.ownerId !== userId) throwError('Forbidden: You are not the owner of this commerce.', 403);
    return prisma.event.create({ data: { ...data, commerceId: parseInt(commerceId) } });
};

export const getEventsByCommerceModel = async (commerceId) => {
    if (!(await prisma.commerce.findUnique({ where: { id: parseInt(commerceId) } }))) {
        throwError('Commerce not found.', 404);
    }
    return prisma.event.findMany({ where: { commerceId: parseInt(commerceId) }, orderBy: { startDate: 'asc' } });
};

export const updateEventModel = async (eventId, data, userId) => {
    const event = await prisma.event.findUnique({ where: { id: parseInt(eventId) }, include: { commerce: true } });
    if (!event) throwError('Event not found.', 404);
    if (event.commerce.ownerId !== userId) throwError('Forbidden: You do not have permission to update this event.', 403);
    return prisma.event.update({ where: { id: parseInt(eventId) }, data });
};

export const deleteEventModel = async (eventId, userId) => {
    const event = await prisma.event.findUnique({ where: { id: parseInt(eventId) }, include: { commerce: true } });
    if (!event) throwError('Event not found.', 404);
    if (event.commerce.ownerId !== userId) throwError('Forbidden: You do not have permission to delete this event.', 403);
    await prisma.event.delete({ where: { id: parseInt(eventId) } });
};