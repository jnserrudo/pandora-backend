import * as authModel from '../models/auth.model.js';

export const registerUser = async (req, res) => {
    try {
        const { email, username, password, name } = req.body;
        if (!email || !username || !password || !name) {
            return res.status(400).json({ message: 'Email, username, name, and password are required.' });
        }
        const newUser = await authModel.registerUserService(req.body);
        res.status(201).json({ message: 'User registered successfully!', user: newUser });
    } catch (error) {
        console.log(error);
        res.status(error.statusCode || 500).json({ message: error.message || 'Internal server error.' });
    }
};

export const loginUser = async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password) {
            return res.status(400).json({ message: 'Identifier (email or username) and password are required.' });
        }
        const tokens = await authModel.loginUserService(identifier, password);
        res.status(200).json({ message: 'Login successful!', ...tokens });
    } catch (error) {
        console.log(error);
        res.status(error.statusCode || 500).json({ message: error.message || 'Internal server error.' });
    }
};

export const refreshAccessToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        const result = await authModel.refreshAccessTokenService(refreshToken);
        res.status(200).json(result);
    } catch (error) {
        console.log(error);
        res.status(error.statusCode || 500).json({ message: error.message || 'Internal server error.' });
    }
};

export const logoutUser = async (req, res) => {
    try {
        await authModel.logoutUserService(req.user.id);
        res.status(200).json({ message: 'Logged out successfully.' });
    } catch (error) {
        console.log(error);
        res.status(error.statusCode || 500).json({ message: error.message || 'Internal server error.' });
    }
};