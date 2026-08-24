import * as favoriteModel from '../models/favorite.model.js';
import * as auditService from '../services/audit.service.js';

export const toggleFavorite = async (req, res) => {
    try {
        const { resourceType, resourceId } = favoriteModel.parseFavoritePayload(req.body);
        const result = await favoriteModel.toggleFavoriteModel(req.user.id, resourceType, resourceId);
        await auditService.createLog({
            userId: req.user.id,
            action: result.favorited ? 'CREATE' : 'DELETE',
            resourceType: 'FAVORITE',
            resourceId,
            oldData: result.favorited ? null : { resourceType, resourceId, favorited: true },
            newData: result.favorited ? { resourceType, resourceId, favorited: true } : null,
            ipAddress: req.ip,
        });
        res.status(200).json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

export const getMyFavorites = async (req, res) => {
    try {
        const favorites = await favoriteModel.getMyFavoritesModel(req.user.id);
        res.status(200).json(favorites);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message || 'Error interno del servidor.' });
    }
};
