import prisma from '../db/prismaClient.js';

/**
 * Registrar una búsqueda en la base de datos
 */
export const logSearch = async (req, res) => {
  try {
    const { term } = req.body;
    if (!term || term.trim().length < 2) {
      return res.status(400).json({ message: "Term too short" });
    }

    const searchQuery = term.trim().toLowerCase();

    // Upsert: Increment count if exists, create if not
    const result = await prisma.searchQuery.upsert({
      where: { term: searchQuery },
      update: { 
        count: { increment: 1 },
        lastSearched: new Date()
      },
      create: { 
        term: searchQuery,
        count: 1
      }
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Obtener las búsquedas más frecuentes (Top 10)
 */
export const getTopSearches = async (req, res) => {
  try {
    const topSearches = await prisma.searchQuery.findMany({
      orderBy: { count: 'desc' },
      take: 10
    });
    res.status(200).json(topSearches);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
