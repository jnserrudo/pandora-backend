import * as userModel from '../models/user.model.js';
export const getCurrentUser = async (req, res) => {
    try {
        const user = await userModel.getCurrentUserModel(req.user.id);
        res.status(200).json(user);
    } catch (error) { res.status(error.statusCode || 500).json({ message: error.message }); }
};
export const updateCurrentUser = async (req, res) => {
    try {
        const user = await userModel.updateCurrentUserModel(req.user.id, req.body);
        res.status(200).json({ message: 'Profile updated successfully', user });
    } catch (error) { res.status(error.statusCode || 500).json({ message: error.message }); }
};