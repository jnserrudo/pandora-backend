import prisma from '../db/prismaClient.js';
import { throwError } from '../utils/error.utils.js';
import { moderateContent, attachModerationResource, collectImageUrls } from '../services/moderation.service.js';

// --- FUNCIONES PÚBLICAS (PARA CONSUMIDORES) ---

/**
 * Obtiene todos los eventos programados, ordenados por fecha de inicio.
 * Incluye información básica del comercio al que pertenecen.
 * @returns {Promise<Array>} Lista de eventos.
 */
export const getAllEventsModel = async (filters = {}) => {
    const { category, commerceId, startDate, endDate, page = 1, limit = 50, includeAll = false } = filters;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    return prisma.event.findMany({
        where: {
            ...(includeAll
                ? {}
                : {
                    status: 'SCHEDULED',
                    isActive: true,
                    NOT: { paymentStatus: 'REJECTED' },
                }),
            ...(category && { category }),
            ...(commerceId && { commerceId: parseInt(commerceId) }),
            ...(startDate && endDate && {
                startDate: {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                }
            })
        },
        skip,
        take: parseInt(limit),
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
export const getEventByIdModel = async (id, viewer = null) => {
    const event = await prisma.event.findUnique({
        where: { id: parseInt(id) },
        include: {
            commerce: true,
        },
    });
    if (!event) {
        throwError('Evento no encontrado o no está activo.', 404);
    }

    const isPublic = event.status === 'SCHEDULED'
        && event.isActive
        && event.paymentStatus !== 'REJECTED';
    const isPrivileged = viewer && (
        viewer.role === 'ADMIN' ||
        (event.commerce && Number(viewer.id) === Number(event.commerce.ownerId))
    );

    if (!isPublic && !isPrivileged) {
        throwError('Evento no encontrado o no está activo.', 404);
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
    const { commerceId, status: _ignoredStatus, ...eventData } = data;

    if (!commerceId) {
        throwError('El commerceId es requerido para crear un evento.', 400);
    }
    
    const commerce = await prisma.commerce.findUnique({
        where: { id: parseInt(commerceId) },
    });

    if (!commerce) {
        throwError('Comercio no encontrado.', 404);
    }
    if (commerce.ownerId !== ownerId && userRole !== 'ADMIN') {
        throwError('Prohibido: no sos el dueño de este comercio.', 403);
    }

    const moderationResult = await moderateContent(
        `${eventData.name || ''}\n${eventData.description || ''}`,
        'EVENT',
        null,
        collectImageUrls(eventData)
    );

    const created = await prisma.event.create({
        data: {
            ...eventData,
            status: userRole === 'ADMIN' ? 'SCHEDULED' : 'PENDING',
            commerce: { connect: { id: parseInt(commerceId) } },
        },
    });
    await attachModerationResource(moderationResult.logId, created.id);
    return created;
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
        throwError('Evento no encontrado.', 404);
    }
    if (event.commerce.ownerId !== ownerId && userRole !== 'ADMIN') {
        throwError('Prohibido: no tenés permiso para actualizar este evento.', 403);
    }
    
    // Excluimos campos que no deberían cambiar en una actualización simple
    const { id, commerceId, ...updateData } = data;

    await moderateContent(
        `${updateData.name || event.name}\n${updateData.description || event.description}`,
        'EVENT',
        event.id,
        collectImageUrls({ ...event, ...updateData })
    );

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
        throwError('Evento no encontrado.', 404);
    }
    if (event.commerce.ownerId !== ownerId && userRole !== 'ADMIN') {
        throwError('Prohibido: no tenés permiso para eliminar este evento.', 403);
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
export const approveEventModel = async (id) => {
    return prisma.event.update({
        where: { id: parseInt(id) },
        data: { status: 'SCHEDULED', isActive: true }
    });
};

export const rejectEventModel = async (id) => {
    return prisma.event.update({
        where: { id: parseInt(id) },
        data: { status: 'REJECTED', isActive: false }
    });
};

export const validateEventPaymentModel = async (id, paymentStatus) => {
    if (!['VALIDATED', 'REJECTED'].includes(paymentStatus)) {
        throwError('Estado de pago inválido. Debe ser VALIDATED o REJECTED.', 400);
    }

    const event = await prisma.event.findUnique({
        where: { id: parseInt(id) }
    });

    if (!event) {
        throwError('Evento no encontrado.', 404);
    }

    if (event.eventTier === 1) {
        throwError('Los eventos de categoría básica no requieren validación de pago.', 400);
    }

    return prisma.event.update({
        where: { id: parseInt(id) },
        data: {
            paymentStatus,
            ...(paymentStatus === 'REJECTED' && { isActive: false }),
        }
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