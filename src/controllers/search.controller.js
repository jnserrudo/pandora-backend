import * as searchModel from '../models/search.model.js';

export const searchGlobal = async (req, res) => {
    // El término de búsqueda vendrá como un query parameter, ej: /api/search?q=rock
    const { q } = req.query; 

    if (!q || q.trim() === '') {
        return res.status(400).json({ message: 'El término de búsqueda (q) es requerido.' });
    }
    
    try {
        const results = await searchModel.searchGlobalModel(q);
        res.status(200).json(results);
    } catch (error) {
        console.error('[SEARCH] Error:', error.message);
        res.status(500).json({ message: 'Ocurrió un error durante la búsqueda.' });
    }
};