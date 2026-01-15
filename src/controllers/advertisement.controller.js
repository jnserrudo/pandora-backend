import * as advertisementModel from '../models/advertisement.model.js';

export const getAdvertisements = async (req, res) => {
    try {
        const advertisements = await advertisementModel.getAllAdvertisementsModel(req.query);
        res.status(200).json(advertisements);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getAdvertisementById = async (req, res) => {
    try {
        const advertisement = await advertisementModel.getAdvertisementByIdModel(req.params.id);
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
        res.status(201).json(newAd);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const updateAdvertisement = async (req, res) => {
    try {
        const updatedAd = await advertisementModel.updateAdvertisementModel(req.params.id, req.body);
        res.status(200).json(updatedAd);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteAdvertisement = async (req, res) => {
    try {
        await advertisementModel.deleteAdvertisementModel(req.params.id);
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
