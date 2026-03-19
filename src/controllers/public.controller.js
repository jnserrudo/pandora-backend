import prisma from '../db/prismaClient.js';

export const getPublicStats = async (req, res) => {
    try {
        const [articlesCount, eventsCount, commercesCount, plansCount] = await Promise.all([
            prisma.article.count(),
            prisma.event.count(),
            prisma.commerce.count(),
            prisma.plan.count()
        ]);

        console.log('Public Stats Debug:', { articlesCount, eventsCount, commercesCount, plansCount });

        res.status(200).json({
            articles: articlesCount,
            events: eventsCount,
            commerces: commercesCount,
            plans: plansCount
        });
    } catch (error) {
        console.error("Error fetching public stats:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
