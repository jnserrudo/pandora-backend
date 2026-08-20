import prisma from '../db/prismaClient.js';
import { throwError } from '../utils/error.utils.js';

const ALLOWED_TYPES = new Set(['commerce', 'event', 'article']);

export function normalizeFavoriteType(resourceType) {
    return String(resourceType || '').trim().toLowerCase();
}

export function parseFavoritePayload(body = {}) {
    const resourceType = normalizeFavoriteType(body.resourceType);
    const resourceId = parseInt(body.resourceId, 10);

    if (!ALLOWED_TYPES.has(resourceType)) {
        throwError('resourceType debe ser commerce, event o article.', 400);
    }
    if (!Number.isInteger(resourceId) || resourceId <= 0) {
        throwError('resourceId debe ser un entero positivo.', 400);
    }

    return { resourceType, resourceId };
}

export async function toggleFavoriteModel(userId, resourceType, resourceId) {
    const existing = await prisma.favorite.findUnique({
        where: {
            userId_resourceType_resourceId: { userId, resourceType, resourceId },
        },
    });

    if (existing) {
        await prisma.favorite.delete({ where: { id: existing.id } });
        return { favorited: false, resourceType, resourceId };
    }

    await prisma.favorite.create({
        data: { userId, resourceType, resourceId },
    });
    return { favorited: true, resourceType, resourceId };
}

async function loadResource(resourceType, resourceId) {
    if (resourceType === 'commerce') {
        return prisma.commerce.findUnique({
            where: { id: resourceId },
            select: { id: true, name: true, coverImage: true, category: true, status: true, isActive: true },
        });
    }
    if (resourceType === 'event') {
        return prisma.event.findUnique({
            where: { id: resourceId },
            select: { id: true, name: true, coverImage: true, status: true, isActive: true },
        });
    }
    return prisma.article.findUnique({
        where: { id: resourceId },
        select: { id: true, title: true, coverImage: true, status: true, isActive: true },
    });
}

function isPublicResource(resourceType, resource) {
    if (!resource) return false;
    if (resourceType === 'commerce') {
        return resource.status === 'ACTIVE' && resource.isActive !== false;
    }
    if (resourceType === 'event') {
        return resource.status === 'SCHEDULED' && resource.isActive !== false;
    }
    return resource.status === 'PUBLISHED' || resource.isActive !== false;
}

export async function getMyFavoritesModel(userId) {
    const rows = await prisma.favorite.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
    });

    const grouped = { commerce: [], event: [], article: [] };
    for (const row of rows) {
        if (grouped[row.resourceType]) grouped[row.resourceType].push(row.resourceId);
    }

    const [commerces, events, articles] = await Promise.all([
        grouped.commerce.length
            ? prisma.commerce.findMany({
                where: { id: { in: grouped.commerce } },
                select: { id: true, name: true, coverImage: true, category: true, status: true, isActive: true },
            })
            : [],
        grouped.event.length
            ? prisma.event.findMany({
                where: { id: { in: grouped.event } },
                select: { id: true, name: true, coverImage: true, status: true, isActive: true },
            })
            : [],
        grouped.article.length
            ? prisma.article.findMany({
                where: { id: { in: grouped.article } },
                select: { id: true, title: true, coverImage: true, status: true, isActive: true },
            })
            : [],
    ]);

    const byType = {
        commerce: Object.fromEntries(commerces.map((c) => [c.id, c])),
        event: Object.fromEntries(events.map((e) => [e.id, e])),
        article: Object.fromEntries(articles.map((a) => [a.id, a])),
    };

    return rows.map((row) => {
        const raw = byType[row.resourceType]?.[row.resourceId] || null;
        const unavailable = !isPublicResource(row.resourceType, raw);
        const resource = raw
            ? {
                ...raw,
                name: raw.name || raw.title,
            }
            : {};

        return {
            id: row.id,
            resourceType: row.resourceType,
            resourceId: row.resourceId,
            commerceId: row.resourceType === 'commerce' ? row.resourceId : undefined,
            commerce: row.resourceType === 'commerce' && raw ? raw : undefined,
            resource,
            unavailable,
        };
    });
}

export { loadResource };
