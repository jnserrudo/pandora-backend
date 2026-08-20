import prisma from '../db/prismaClient.js';

export const getPublicStats = async (req, res) => {
    try {
        const [articlesCount, eventsCount, commercesCount, plansCount] = await Promise.all([
            prisma.article.count(),
            prisma.event.count(),
            prisma.commerce.count(),
            prisma.plan.count()
        ]);

        console.log(`[PUBLIC] Stats - artículos: ${articlesCount}, eventos: ${eventsCount}, comercios: ${commercesCount}`);

        res.status(200).json({
            articles: articlesCount,
            events: eventsCount,
            commerces: commercesCount,
            plans: plansCount
        });
    } catch (error) {
        console.error('[PUBLIC] Error:', error.message);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};
