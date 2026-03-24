import * as authModel from '../models/auth.model.js';
import * as auditService from '../services/audit.service.js';
import { sendVerificationOTP } from '../services/email.service.js';
import prisma from '../db/prismaClient.js';

export const registerUser = async (req, res) => {
    try {
        const { email, username, password, name, captchaToken } = req.body;
        if (!email || !username || !password || !name) {
            return res.status(400).json({ message: 'Email, username, name, and password are required.' });
        }
        
        // Pass the body to the service
        const { user: newUser, otpCode } = await authModel.registerUserService(req.body);
        console.log("Nuevo usuario:", newUser.email);
        
        // Despachar el correo electrónico con otpCode
        await sendVerificationOTP(newUser.email, otpCode).catch(err => console.error("Error enviando email OTP:", err));
        
        res.status(201).json({ message: 'User registered successfully! Please check your email.', user: newUser });

        // Auditoría
        await auditService.createLog({
            userId: newUser.id,
            action: 'CREATE',
            resourceType: 'USER',
            resourceId: newUser.id,
            newData: newUser,
            ipAddress: req.ip
        });
    } catch (error) {
        console.log(error);
        res.status(error.statusCode || 500).json({
            message: error.message || 'Internal server error.',
            requireCaptcha: error.requireCaptcha,
            isVerified: error.isVerified
        });
    }
};

export const loginUser = async (req, res) => {
    try {
        const { identifier, password, captchaToken } = req.body;
        if (!identifier || !password) {
            return res.status(400).json({ message: 'Identifier (email or username) and password are required.' });
        }
        const tokens = await authModel.loginUserService(identifier, password, captchaToken);
        console.log('logeado');
        res.status(200).json({ message: 'Login successful!', ...tokens });

        // Auditoría
        const user = await prisma.user.findFirst({ where: { OR: [{ email: identifier }, { username: identifier }] } });
        await auditService.createLog({
            userId: user?.id,
            action: 'LOGIN',
            resourceType: 'USER',
            resourceId: user?.id,
            ipAddress: req.ip
        });
    } catch (error) {
        console.log(error);
        res.status(error.statusCode || 500).json({
            message: error.message || 'Internal server error.',
            requireCaptcha: error.requireCaptcha,
            isVerified: error.isVerified
        });
    }
};

export const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and OTP are required.' });
        }
        const result = await authModel.verifyOTPService(email, otp);
        res.status(200).json({ message: 'Cuenta verificada con éxito', ...result });
    } catch (error) {
        console.log(error);
        res.status(error.statusCode || 500).json({ message: error.message || 'Internal server error.' });
    }
};

export const refreshAccessToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        const result = await authModel.refreshAccessTokenService(refreshToken);
        console.log('refresh');
        res.status(200).json(result);
    } catch (error) {
        console.log(error);
        res.status(error.statusCode || 500).json({ message: error.message || 'Internal server error.' });
    }
};

export const logoutUser = async (req, res) => {
    try {
        await authModel.logoutUserService(req.user.id);
        console.log('logout');
        res.status(200).json({ message: 'Logged out successfully.' });
    } catch (error) {
        console.log(error);
        res.status(error.statusCode || 500).json({ message: error.message || 'Internal server error.' });
    }
};