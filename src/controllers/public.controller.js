import prisma from '../db/prismaClient.js';

export const getPublicStats = async (req, res) => {
    try {
        const [articlesCount, eventsCount, commercesCount] = await Promise.all([
            prisma.article.count(),
            prisma.event.count(),
            prisma.commerce.count()
        ]);

        console.log('Public Stats Debug:', { articlesCount, eventsCount, commercesCount });

        res.status(200).json({
            articles: articlesCount,
            events: eventsCount,
            commerces: commercesCount
        });
    } catch (error) {
        console.error("Error fetching public stats:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
