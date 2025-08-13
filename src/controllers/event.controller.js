import * as eventModel from '../models/event.model.js';

// --- CONTROLADORES PÚBLICOS ---

export const getEvents = async (req, res) => {
    try {
        const events = await eventModel.getAllEventsModel();
        res.status(200).json(events);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const getEventById = async (req, res) => {
    try {
        const { id } = req.params;
        const event = await eventModel.getEventByIdModel(id);
        res.status(200).json(event);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

// --- CONTROLADORES PROTEGIDOS ---

export const createEvent = async (req, res) => {
    try {
        const event = await eventModel.createEventModel(req.body, req.user.id);
        res.status(201).json(event);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedEvent = await eventModel.updateEventModel(id, req.body, req.user.id);
        res.status(200).json(updatedEvent);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        await eventModel.deleteEventModel(id, req.user.id);
        res.status(204).send(); // 204 No Content es la respuesta estándar para un delete exitoso.
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};