import * as eventModel from '../models/event.model.js';
export const createEvent = async (req, res) => {
    try { res.status(201).json(await eventModel.createEventModel(req.body, req.user.id)); }
    catch (error) { res.status(error.statusCode || 500).json({ message: error.message }); }
};
export const getEventsByCommerce = async (req, res) => {
    try { res.status(200).json(await eventModel.getEventsByCommerceModel(req.params.commerceId)); }
    catch (error) { res.status(error.statusCode || 500).json({ message: error.message }); }
};
export const updateEvent = async (req, res) => {
    try { res.status(200).json(await eventModel.updateEventModel(req.params.id, req.body, req.user.id)); }
    catch (error) { res.status(error.statusCode || 500).json({ message: error.message }); }
};
export const deleteEvent = async (req, res) => {
    try { await eventModel.deleteEventModel(req.params.id, req.user.id); res.status(204).send(); }
    catch (error) { res.status(error.statusCode || 500).json({ message: error.message }); }
};