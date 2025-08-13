import * as userModel from '../models/user.model.js';

/**
 * Obtiene el perfil del usuario actualmente autenticado.
 */
export const getMyProfile = async (req, res) => {
    try {
        // req.user.id es añadido por el middleware authenticateToken
        const userProfile = await userModel.getUserProfileModel(req.user.id);
        res.status(200).json(userProfile);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

/**
 * Actualiza el perfil del usuario actualmente autenticado.
 */
export const updateMyProfile = async (req, res) => {
    try {
        const updatedUser = await userModel.updateUserProfileModel(req.user.id, req.body);
        res.status(200).json(updatedUser);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};