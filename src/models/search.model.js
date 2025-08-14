import prisma from '../db/prismaClient.js';

export const searchGlobalModel = async (query) => {
    // MySQL Full-Text Search a menudo funciona mejor si se añade un '*'
    // al final de cada palabra para buscar prefijos (ej. 'roc' encontrará 'rock').
    const searchQuery = query.split(' ').map(word => `${word}*`).join(' ');

    const [commerces, events] = await Promise.all([
        // Búsqueda en Comercios
        prisma.commerce.findMany({
            where: {
                status: 'ACTIVE',
                // --- USAMOS EL NUEVO OPERADOR 'search' ---
                name: {
                    search: searchQuery,
                },
                description: {
                    search: searchQuery,
                },
            },
        }),
        // Búsqueda en Eventos
        prisma.event.findMany({
            where: {
                status: 'SCHEDULED',
                // --- USAMOS EL NUEVO OPERADOR 'search' ---
                name: {
                    search: searchQuery,
                },
                description: {
                    search: searchQuery,
                },
            },
            include: {
                commerce: true,
            },
        }),
    ]);

    // Añadimos un campo 'type' a cada resultado para que el frontend sepa qué es
    const commerceResults = commerces.map(c => ({ ...c, type: 'commerce' }));
    const eventResults = events.map(e => ({ ...e, type: 'event' }));

    // Combinamos y devolvemos los resultados
    return [...commerceResults, ...eventResults];
};