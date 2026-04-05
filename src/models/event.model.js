import prisma from '../db/prismaClient.js';
import { throwError } from '../utils/error.utils.js';

// --- FUNCIONES PÚBLICAS (PARA CONSUMIDORES) ---

/**
 * Obtiene todos los eventos programados, ordenados por fecha de inicio.
 * Incluye información básica del comercio al que pertenecen.
 * @returns {Promise<Array>} Lista de eventos.
 */
export const getAllEventsModel = async (filters = {}) => {
    const { category, commerceId, startDate, endDate } = filters;
    
    return prisma.event.findMany({
        where: { 
            status: 'SCHEDULED',
            isActive: true,
            ...(category && { category }),
            ...(commerceId && { commerceId: parseInt(commerceId) }),
            ...(startDate && endDate && {
                startDate: {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                }
            })
        },
        orderBy: { startDate: 'asc' },
        include: {
            commerce: {
                select: {
                    name: true,
                    address: true,
                },
            },
        },
    });
};

/**
 * Obtiene un solo evento por su ID.
 * @param {number} id - El ID del evento.
 * @returns {Promise<Object>} El objeto del evento.
 */
export const getEventByIdModel = async (id) => {
    const event = await prisma.event.findUnique({
        where: { id: parseInt(id) },
        include: {
            commerce: true, // Incluimos todos los datos del comercio
        },
    });
    if (!event || event.status !== 'SCHEDULED' || !event.isActive) {
        throwError('Event not found or is not active.', 404);
    }
    return event;
};

// --- FUNCIONES PROTEGIDAS (PARA OWNERS/ADMINS) ---

/**
 * Crea un nuevo evento, verificando que el usuario sea el dueño del comercio o admin.
 * @param {object} data - Datos del evento desde el body.
 * @param {number} ownerId - ID del usuario autenticado.
 * @param {string} userRole - Rol del usuario autenticado.
 * @returns {Promise<Object>} El nuevo evento creado.
 */
export const createEventModel = async (data, ownerId, userRole) => {
    const { commerceId, ...eventData } = data;

    if (!commerceId) {
        throwError('commerceId is required to create an event.', 400);
    }
    
    const commerce = await prisma.commerce.findUnique({
        where: { id: parseInt(commerceId) },
    });

    if (!commerce) {
        throwError('Commerce not found.', 404);
    }
    if (commerce.ownerId !== ownerId && userRole !== 'ADMIN') {
        throwError('Forbidden: You are not the owner of this commerce.', 403);
    }

    return prisma.event.create({
        data: {
            ...eventData,
            commerce: { connect: { id: parseInt(commerceId) } },
        },
    });
};

/**
 * Actualiza un evento, verificando que el usuario sea el dueño del comercio o admin.
 * @param {number} eventId - ID del evento a actualizar.
 * @param {object} data - Datos a actualizar.
 * @param {number} ownerId - ID del usuario autenticado.
 * @param {string} userRole - Rol del usuario autenticado.
 * @returns {Promise<Object>} El evento actualizado.
 */
export const updateEventModel = async (eventId, data, ownerId, userRole) => {
    const event = await prisma.event.findUnique({
        where: { id: parseInt(eventId) },
        include: { commerce: true },
    });

    if (!event) {
        throwError('Event not found.', 404);
    }
    if (event.commerce.ownerId !== ownerId && userRole !== 'ADMIN') {
        throwError('Forbidden: You do not have permission to update this event.', 403);
    }
    
    // Excluimos campos que no deberían cambiar en una actualización simple
    const { id, commerceId, ...updateData } = data;

    return prisma.event.update({
        where: { id: parseInt(eventId) },
        data: updateData,
    });
};

/**
 * Elimina un evento, verificando que el usuario sea el dueño o admin.
 * @param {number} eventId - ID del evento a eliminar.
 * @param {number} ownerId - ID del usuario autenticado.
 * @param {string} userRole - Rol del usuario autenticado.
 */
export const deleteEventModel = async (eventId, ownerId, userRole) => {
    const event = await prisma.event.findUnique({
        where: { id: parseInt(eventId) },
        include: { commerce: true },
    });

    if (!event) {
        throwError('Event not found.', 404);
    }
    if (event.commerce.ownerId !== ownerId && userRole !== 'ADMIN') {
        throwError('Forbidden: You do not have permission to delete this event.', 403);
    }

    await prisma.event.update({
        where: { id: parseInt(eventId) },
        data: { isActive: false }
    });
};

/**
 * Actualiza el estado isActive de un evento (solo ADMIN).
 */
export const updateEventStatusModel = async (id, isActive) => {
    return prisma.event.update({
        where: { id: parseInt(id) },
        data: { isActive }
    });
};

/**
 * Valida o rechaza el pago de un evento (solo ADMIN).
 * @param {number} id - ID del evento.
 * @param {string} paymentStatus - 'VALIDATED' o 'REJECTED'.
 * @returns {Promise<Object>} El evento actualizado.
 */
export const validateEventPaymentModel = async (id, paymentStatus) => {
    if (!['VALIDATED', 'REJECTED'].includes(paymentStatus)) {
        throwError('Invalid payment status. Must be VALIDATED or REJECTED.', 400);
    }

    const event = await prisma.event.findUnique({
        where: { id: parseInt(id) }
    });

    if (!event) {
        throwError('Event not found.', 404);
    }

    if (event.eventTier === 1) {
        throwError('Basic tier events do not require payment validation.', 400);
    }

    return prisma.event.update({
        where: { id: parseInt(id) },
        data: { paymentStatus }
    });
};

/**
 * Obtiene todos los eventos del usuario autenticado.
 * @param {number} userId - ID del usuario.
 * @returns {Promise<Array>} Lista de eventos del usuario.
 */
export const getMyEventsModel = async (userId) => {
    return prisma.event.findMany({
        where: {
            commerce: {
                ownerId: userId
            }
        },
        include: {
            commerce: {
                select: {
                    id: true,
                    name: true,
                    address: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
};