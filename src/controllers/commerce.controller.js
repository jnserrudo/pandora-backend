import * as commerceModel from '../models/commerce.model.js';

// --- CONTROLADORES PÚBLICOS ---

export const getCommerces = async (req, res) => {
    const { category } = req.query;
    try {
        const commerces = category
            ? await commerceModel.getCommercesByCategoryModel(category) // Pasamos el string tal cual
            : await commerceModel.getAllCommercesModel();
        res.status(200).json(commerces);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const getCommerceById = async (req, res) => {
    try {
        const { id } = req.params;
        const commerce = await commerceModel.getCommerceByIdModel(id);
        res.status(200).json(commerce);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

// --- CONTROLADORES PROTEGIDOS ---

export const createCommerce = async (req, res) => {
    try {
        const commerce = await commerceModel.createCommerceModel(req.body, req.user.id);
        res.status(201).json(commerce);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const getMyCommerce = async (req, res) => {
    try {
        const commerce = await commerceModel.getCommerceByOwnerModel(req.user.id);
        res.status(200).json(commerce);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const updateMyCommerce = async (req, res) => {
    try {
        const updatedCommerce = await commerceModel.updateCommerceByOwnerModel(req.user.id, req.body);
        res.status(200).json(updatedCommerce);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};