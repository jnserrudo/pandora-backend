import * as advertisementModel from '../models/advertisement.model.js';
import * as auditService from '../services/audit.service.js';
import prisma from '../db/prismaClient.js';

export const getAdvertisements = async (req, res) => {
    try {
        // Si el usuario es ADMIN y pasa el query param admin=true, devolvemos todo
        const adminMode = req.query.admin === 'true';
        const advertisements = await advertisementModel.getAllAdvertisementsModel(req.query, adminMode);
        res.status(200).json(advertisements);
    } catch (error) {
        console.error("Error in getAdvertisements controller:", error);
        // Fallback to empty array instead of 500 for better UX in public site
        res.status(200).json([]);
    }
};

export const getAdvertisementById = async (req, res) => {
    try {
        // adminMode: si tiene token de admin, puede ver publicidades inactivas
        const adminMode = req.query.admin === 'true';
        const advertisement = await advertisementModel.getAdvertisementByIdModel(req.params.id, adminMode);
        if (!advertisement) {
            return res.status(404).json({ message: 'Advertisement not found' });
        }
        res.status(200).json(advertisement);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const createAdvertisement = async (req, res) => {
    try {
        const newAd = await advertisementModel.createAdvertisementModel(req.body);
        
        // Auditoría
        await auditService.createLog({
            userId: req.user.id,
            action: 'CREATE',
            resourceType: 'ADVERTISEMENT',
            resourceId: newAd.id,
            newData: newAd,
            ipAddress: req.ip
        });

        res.status(201).json(newAd);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const updateAdvertisement = async (req, res) => {
    try {
        const oldAd = await prisma.advertisement.findUnique({ where: { id: parseInt(req.params.id) } });
        const updatedAd = await advertisementModel.updateAdvertisementModel(req.params.id, req.body);
        
        // Auditoría
        await auditService.createLog({
            userId: req.user.id,
            action: 'UPDATE',
            resourceType: 'ADVERTISEMENT',
            resourceId: updatedAd.id,
            oldData: oldAd,
            newData: updatedAd,
            ipAddress: req.ip
        });

        res.status(200).json(updatedAd);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteAdvertisement = async (req, res) => {
    try {
        const oldAd = await prisma.advertisement.findUnique({ where: { id: parseInt(req.params.id) } });
        await advertisementModel.deleteAdvertisementModel(req.params.id);
        
        // Auditoría
        await auditService.createLog({
            userId: req.user.id,
            action: 'DELETE',
            resourceType: 'ADVERTISEMENT',
            resourceId: parseInt(req.params.id),
            oldData: oldAd,
            ipAddress: req.ip
        });

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const trackAdvertisement = async (req, res) => {
    try {
        const { type } = req.body;
        if (!['impression', 'click'].includes(type)) {
            return res.status(400).json({ message: 'Invalid track type. Must be "impression" or "click".' });
        }
        await advertisementModel.trackAdvertisementModel(req.params.id, type);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
