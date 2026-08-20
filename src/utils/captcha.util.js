import * as crypto from 'crypto';

export const generateOTP = () => {
    // 6 digit code
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export const verifyTurnstileToken = async (token) => {
    if (process.env.NODE_ENV === 'test' || process.env.SKIP_CAPTCHA === 'true') {
        return true;
    }

    if (!token) return false;

    try {
        const secretKey = process.env.TURNSTILE_SECRET_KEY;
        if (!secretKey) {
            if (process.env.NODE_ENV === 'production') {
                console.error('[CAPTCHA] TURNSTILE_SECRET_KEY is not defined. Rejecting captcha in production.');
                return false;
            }
            console.warn('[CAPTCHA] TURNSTILE_SECRET_KEY is not defined. Skipping validation in development.');
            return true;
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
        console.error('[CAPTCHA] Error verificando captcha:', error.message);
        return false;
    }
};
