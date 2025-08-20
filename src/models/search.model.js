// En tu archivo de modelo de búsqueda (ej. src/models/search.model.js)

import prisma from '../db/prismaClient.js';

export const searchGlobalModel = async (query) => {
    // MySQL Full-Text Search a menudo funciona mejor si se añade un '*'
    // al final de cada palabra para buscar prefijos (ej. 'roc' encontrará 'rock').
    const searchQuery = query.split(' ').map(word => `${word}*`).join(' ');

    // --- 1. AÑADIMOS 'articles' A LA BÚSQUEDA EN PARALELO ---
    const [commerces, events, articles] = await Promise.all([
        // Búsqueda en Comercios (sin cambios)
        prisma.commerce.findMany({
            where: {
                status: 'ACTIVE',
                OR: [
                    { name: { search: searchQuery } },
                    { description: { search: searchQuery } },
                ],
            },
        }),
        // Búsqueda en Eventos (sin cambios)
        prisma.event.findMany({
            where: {
                status: 'SCHEDULED',
                OR: [
                    { name: { search: searchQuery } },
                    { description: { search: searchQuery } },
                ],
            },
            include: { commerce: true },
        }),
        // --- 2. NUEVA BÚSQUEDA EN ARTÍCULOS ---
        prisma.article.findMany({
            where: {
                status: 'PUBLISHED', // Solo buscar en artículos publicados
                OR: [
                    { title: { search: searchQuery } },
                    { subtitle: { search: searchQuery } },
                    { content: { search: searchQuery } },
                ],
            },
        }),
    ]);

    // --- 3. PROCESAMOS Y COMBINAMOS TODOS LOS RESULTADOS ---

    // Añadimos un campo 'type' a cada resultado
    const commerceResults = commerces.map(c => ({ ...c, type: 'commerce' }));
    const eventResults = events.map(e => ({ ...e, type: 'event' }));
    const articleResults = articles.map(a => ({ ...a, type: 'article' })); // <-- Mapeamos los resultados de artículos

    // Combinamos y devolvemos los resultados de las TRES búsquedas
    return [...commerceResults, ...eventResults, ...articleResults];
};