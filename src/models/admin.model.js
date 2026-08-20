import prisma from '../db/prismaClient.js';

/**
 * Obtiene métricas globales de publicidad y usuarios.
 */
export const getGlobalStatsModel = async () => {
    const [adStats, newUserCount, pendingCommercesCount, activeAdsCount] = await Promise.all([
        prisma.advertisement.aggregate({
            _sum: {
                impressions: true,
                clicks: true
            }
        }),
        prisma.user.count({
            where: {
                createdAt: {
                    gte: new Date(new Date().setDate(new Date().getDate() - 7))
                }
            }
        }),
        prisma.commerce.count({
            where: { status: 'PENDING' }
        }),
        prisma.advertisement.count({
            where: { isActive: true }
        })
    ]);

    const impressions = adStats._sum.impressions || 0;
    const clicks = adStats._sum.clicks || 0;
    const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : 0;

    return {
        impressions,
        clicks,
        newUsers: newUserCount,
        ctr: `${ctr}%`,
        pendingCommerces: pendingCommercesCount,
        activeAds: activeAdsCount
    };
};

/**
 * Obtiene la distribución de comercios por categoría.
 */
export const getCategoryStatsModel = async () => {
    const categories = await prisma.commerce.groupBy({
        by: ['category'],
        _count: {
            id: true
        }
    });

    // Mapeo de colores estéticos según el front
    const colorMap = {
        'GASTRONOMIA': '#8a2be2',
        'VIDA_NOCTURNA': '#ff2093',
        'SALAS_Y_TEATRO': '#00d4ff',
        'DEFAULT': '#ffbd39'
    };

    const labelMap = {
        'GASTRONOMIA': 'Gastronomía',
        'VIDA_NOCTURNA': 'Vida Nocturna',
        'SALAS_Y_TEATRO': 'Salas y Teatro'
    };

    return categories.map(cat => ({
        name: labelMap[cat.category] || (cat.category
            ? String(cat.category).split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
            : 'Sin categoría'),
        value: cat._count.id,
        color: colorMap[cat.category] || colorMap['DEFAULT']
    }));
};

/**
 * Actividad de los últimos 7 días: altas de usuarios + acciones de auditoría.
 */
export const getWeeklyActivityModel = async () => {
    const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);

    const [users, audits] = await Promise.all([
        prisma.user.findMany({
            where: { createdAt: { gte: start } },
            select: { createdAt: true },
        }),
        prisma.auditLog.findMany({
            where: { createdAt: { gte: start } },
            select: { createdAt: true },
        }),
    ]);

    const bucket = {};
    for (let i = 0; i < 7; i += 1) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        bucket[key] = {
            name: days[d.getDay()],
            altas: 0,
            acciones: 0,
        };
    }

    users.forEach((row) => {
        const key = new Date(row.createdAt).toISOString().slice(0, 10);
        if (bucket[key]) bucket[key].altas += 1;
    });
    audits.forEach((row) => {
        const key = new Date(row.createdAt).toISOString().slice(0, 10);
        if (bucket[key]) bucket[key].acciones += 1;
    });

    return Object.keys(bucket).sort().map((key) => bucket[key]);
};

/**
 * Obtiene el top de búsquedas para el dashboard.
 */
export const getTopSearchesModel = async () => {
    return await prisma.searchQuery.findMany({
        orderBy: { count: 'desc' },
        take: 10
    });
};
