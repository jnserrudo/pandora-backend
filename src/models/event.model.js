import prisma from '../db/prismaClient.js';
import { throwError } from '../utils/error.utils.js';

// --- FUNCIONES PÚBLICAS (PARA CONSUMIDORES) ---

/**
 * Obtiene todos los eventos programados, ordenados por fecha de inicio.
 * Incluye información básica del comercio al que pertenecen.
 * @returns {Promise<Array>} Lista de eventos.
 */
export const getAllEventsModel = async () => {
    return prisma.event.findMany({
        where: { status: 'SCHEDULED' },
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
    if (!event || event.status !== 'SCHEDULED') {
        throwError('Event not found or is not active.', 404);
    }
    return event;
};

// --- FUNCIONES PROTEGIDAS (PARA OWNERS/ADMINS) ---

/**
 * Crea un nuevo evento, verificando que el usuario sea el dueño del comercio.
 * @param {object} data - Datos del evento desde el body.
 * @param {number} ownerId - ID del usuario autenticado.
 * @returns {Promise<Object>} El nuevo evento creado.
 */
export const createEventModel = async (data, ownerId) => {
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
    if (commerce.ownerId !== ownerId) {
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
 * Actualiza un evento, verificando que el usuario sea el dueño del comercio.
 * @param {number} eventId - ID del evento a actualizar.
 * @param {object} data - Datos a actualizar.
 * @param {number} ownerId - ID del usuario autenticado.
 * @returns {Promise<Object>} El evento actualizado.
 */
export const updateEventModel = async (eventId, data, ownerId) => {
    const event = await prisma.event.findUnique({
        where: { id: parseInt(eventId) },
        include: { commerce: true },
    });

    if (!event) {
        throwError('Event not found.', 404);
    }
    if (event.commerce.ownerId !== ownerId) {
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
 * Elimina un evento, verificando que el usuario sea el dueño.
 * @param {number} eventId - ID del evento a eliminar.
 * @param {number} ownerId - ID del usuario autenticado.
 */
export const deleteEventModel = async (eventId, ownerId) => {
    const event = await prisma.event.findUnique({
        where: { id: parseInt(eventId) },
        include: { commerce: true },
    });

    if (!event) {
        throwError('Event not found.', 404);
    }
    if (event.commerce.ownerId !== ownerId) {
        throwError('Forbidden: You do not have permission to delete this event.', 403);
    }

    await prisma.event.delete({
        where: { id: parseInt(eventId) },
    });
};