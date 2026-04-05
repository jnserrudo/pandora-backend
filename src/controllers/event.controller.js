import * as eventModel from '../models/event.model.js';
import * as auditService from '../services/audit.service.js';
import prisma from '../db/prismaClient.js';

// --- CONTROLADORES PÚBLICOS ---

export const getEvents = async (req, res) => {
    try {
        const events = await eventModel.getAllEventsModel(req.query);
        res.status(200).json(events);
    } catch (error) {
        console.log(error);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const getEventById = async (req, res) => {
    try {
        const { id } = req.params;
        const event = await eventModel.getEventByIdModel(id);
        res.status(200).json(event);
    } catch (error) {
        console.log(error);
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
            ipAddress: req.ip
        });

        res.status(201).json(event);
    } catch (error) {
        console.log(error);
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
            ipAddress: req.ip
        });

        res.status(200).json(updatedEvent);
    } catch (error) {
        console.log(error);
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
            ipAddress: req.ip
        });

        res.status(204).send();
    } catch (error) {
        console.log(error);
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
        console.log(error);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

// --- CONTROLADORES ADMIN ---

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
            ipAddress: req.ip
        });

        res.status(200).json(updatedEvent);
    } catch (error) {
        console.log(error);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const getMyEvents = async (req, res) => {
    try {
        const events = await eventModel.getMyEventsModel(req.user.id);
        res.status(200).json(events);
    } catch (error) {
        console.log(error);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};