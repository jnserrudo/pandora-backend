import * as crypto from 'crypto';

export const generateOTP = () => {
    // 6 digit code
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export const verifyTurnstileToken = async (token) => {
    if (!token) return false;
    
    try {
        const secretKey = process.env.TURNSTILE_SECRET_KEY;
        if (!secretKey) {
            console.warn("TURNSTILE_SECRET_KEY is not defined. Skipping validation.");
            return true; // Bypass si no está configurado (útil en dev)
        }

        const formData = new URLSearchParams();
        formData.append('secret', secretKey);
        formData.append('response', token);

        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Error verifying captcha:', error);
        return false;
    }
};
