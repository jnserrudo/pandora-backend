import prisma from '../db/prismaClient.js';

export const searchGlobalModel = async (query) => {
    // La búsqueda se hace en paralelo para mayor eficiencia
    const [commerces, events] = await Promise.all([
        // Búsqueda en Comercios
        prisma.commerce.findMany({
            where: {
                status: 'ACTIVE', // Solo buscar en comercios activos
                OR: [
                    { name: { contains: query, mode: 'insensitive' } }, // insensitive para no distinguir mayús/minús
                    { description: { contains: query, mode: 'insensitive' } },
                ],
            },
        }),
        // Búsqueda en Eventos
        prisma.event.findMany({
            where: {
                status: 'SCHEDULED', // Solo buscar en eventos programados
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { description: { contains: query, mode: 'insensitive' } },
                ],
            },
            // --- ¡LA MEJORA CLAVE ESTÁ AQUÍ! ---
            // Incluimos los datos completos del comercio al que pertenece cada evento.
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