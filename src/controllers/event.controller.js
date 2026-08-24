import * as eventModel from '../models/event.model.js';
import * as notificationModel from '../models/notification.model.js';
import * as auditService from '../services/audit.service.js';
import prisma from '../db/prismaClient.js';

const notifyAdminsNewEvent = async (event) => {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    for (const admin of admins) {
        await notificationModel.createNotificationModel(
            admin.id,
            'NEW_EVENT_REQUEST',
            `Nuevo evento pendiente de validación: ${event.name}`,
            event.id
        );
    }
};

const notifyOwnerEventDecision = async (eventId, approved, adminNote = '') => {
    const event = await prisma.event.findUnique({
        where: { id: parseInt(eventId) },
        include: { commerce: { select: { ownerId: true, name: true } } },
    });
    if (!event?.commerce?.ownerId) return;

    const message = approved
        ? `¡Tu evento "${event.name}" fue aprobado y ya está publicado!`
        : `Tu evento "${event.name}" fue rechazado.${adminNote ? ` Motivo: ${adminNote}` : ''}`;

    await notificationModel.createNotificationModel(
        event.commerce.ownerId,
        'EVENT_VALIDATED',
        message,
        event.id
    );
};

// --- CONTROLADORES PÚBLICOS ---

export const getEvents = async (req, res) => {
    try {
        const { page = 1, limit = 50, includeAll, ...rest } = req.query;
        const safeLimit = Math.min(parseInt(limit), 100);
        const filters = {
            ...rest,
            page: parseInt(page),
            limit: safeLimit,
            // Solo admin con ?includeAll=true ve estados no públicos
            includeAll: String(includeAll || '').toLowerCase() === 'true' && req.user?.role === 'ADMIN',
        };
        const events = await eventModel.getAllEventsModel(filters);
        res.status(200).json(events);
    } catch (error) {
        console.error('[EVENT] Error:', error.message);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const getEventById = async (req, res) => {
    try {
        const { id } = req.params;
        const event = await eventModel.getEventByIdModel(id, req.user || null);
        res.status(200).json(event);
    } catch (error) {
        console.error('[EVENT] Error:', error.message);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

// --- CONTROLADORES PROTEGIDOS ---

export const createEvent = async (req, res) => {
    try {
        const event = await eventModel.createEventModel(req.body, req.user.id, req.user.role);
        
        // Auditoría
        await auditService.createLog({
            userId: req.user.id,
            action: 'CREATE',
            resourceType: 'EVENT',
            resourceId: event.id,
            newData: event,
            req
        });

        // Notificar admins si queda pendiente de validación
        if (event.status === 'PENDING') {
            try {
                await notifyAdminsNewEvent(event);
            } catch (notifErr) {
                console.error('[EVENT] Error notificando admins:', notifErr.message);
            }
        }

        res.status(201).json(event);
    } catch (error) {
        console.error('[EVENT] Error:', error.message);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const oldEvent = await prisma.event.findUnique({ where: { id: parseInt(id) } });
        const updatedEvent = await eventModel.updateEventModel(id, req.body, req.user.id, req.user.role);
        
        // Auditoría
        await auditService.createLog({
            userId: req.user.id,
            action: 'UPDATE',
            resourceType: 'EVENT',
            resourceId: updatedEvent.id,
            oldData: oldEvent,
            newData: updatedEvent,
            req
        });

        res.status(200).json(updatedEvent);
    } catch (error) {
        console.error('[EVENT] Error:', error.message);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const oldEvent = await prisma.event.findUnique({ where: { id: parseInt(id) } });
        await eventModel.deleteEventModel(id, req.user.id, req.user.role);
        
        // Auditoría
        await auditService.createLog({
            userId: req.user.id,
            action: 'DELETE',
            resourceType: 'EVENT',
            resourceId: parseInt(id),
            oldData: oldEvent,
            req
        });

        res.status(204).send();
    } catch (error) {
        console.error('[EVENT] Error:', error.message);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const updateEventStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;
        const updatedEvent = await eventModel.updateEventStatusModel(id, isActive);
        res.status(200).json(updatedEvent);
    } catch (error) {
        console.error('[EVENT] Error:', error.message);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

// --- CONTROLADORES ADMIN ---

export const approveEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const oldEvent = await prisma.event.findUnique({ where: { id: parseInt(id) } });
        if (!oldEvent) {
            return res.status(404).json({ message: 'Evento no encontrado.' });
        }
        const updatedEvent = await eventModel.approveEventModel(id);
        await auditService.createLog({
            userId: req.user.id,
            action: 'STATUS_CHANGE',
            resourceType: 'EVENT',
            resourceId: updatedEvent.id,
            oldData: { status: oldEvent.status },
            newData: { status: updatedEvent.status },
            req
        });
        try {
            await notifyOwnerEventDecision(id, true);
        } catch (notifErr) {
            console.error('[EVENT] Error notificando dueño (aprobación):', notifErr.message);
        }
        res.status(200).json(updatedEvent);
    } catch (error) {
        console.error('[EVENT] Error:', error.message);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const rejectEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const adminNote = req.body?.adminNote || '';
        const oldEvent = await prisma.event.findUnique({ where: { id: parseInt(id) } });
        if (!oldEvent) {
            return res.status(404).json({ message: 'Evento no encontrado.' });
        }
        const updatedEvent = await eventModel.rejectEventModel(id);
        await auditService.createLog({
            userId: req.user.id,
            action: 'STATUS_CHANGE',
            resourceType: 'EVENT',
            resourceId: updatedEvent.id,
            oldData: { status: oldEvent.status },
            newData: { status: updatedEvent.status, adminNote },
            req
        });
        try {
            await notifyOwnerEventDecision(id, false, adminNote);
        } catch (notifErr) {
            console.error('[EVENT] Error notificando dueño (rechazo):', notifErr.message);
        }
        res.status(200).json(updatedEvent);
    } catch (error) {
        console.error('[EVENT] Error:', error.message);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const validateEventPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentStatus } = req.body; // 'VALIDATED' o 'REJECTED'
        
        const oldEvent = await prisma.event.findUnique({ where: { id: parseInt(id) } });
        const updatedEvent = await eventModel.validateEventPaymentModel(id, paymentStatus);
        
        // Auditoría
        await auditService.createLog({
            userId: req.user.id,
            action: 'UPDATE',
            resourceType: 'EVENT',
            resourceId: updatedEvent.id,
            oldData: { paymentStatus: oldEvent.paymentStatus },
            newData: { paymentStatus: updatedEvent.paymentStatus },
            req
        });

        res.status(200).json(updatedEvent);
    } catch (error) {
        console.error('[EVENT] Error:', error.message);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const getMyEvents = async (req, res) => {
    try {
        const events = await eventModel.getMyEventsModel(req.user.id);
        res.status(200).json(events);
    } catch (error) {
        console.error('[EVENT] Error:', error.message);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};