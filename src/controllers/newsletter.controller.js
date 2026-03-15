import prisma from '../db/prismaClient.js';

export const subscribeNewsletter = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: 'Email es requerido' });

        const subscription = await prisma.newsletterSubscription.create({
            data: { email }
        });
        res.status(201).json(subscription);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ message: 'Este email ya está suscrito' });
        }
        res.status(500).json({ message: error.message });
    }
};

export const getSubscriptions = async (req, res) => {
    try {
        const subs = await prisma.newsletterSubscription.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(subs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
