import * as adminModel from '../models/admin.model.js';

export const getAdminStats = async (req, res) => {
    try {
        const [global, categories, activity, searches] = await Promise.all([
            adminModel.getGlobalStatsModel(),
            adminModel.getCategoryStatsModel(),
            adminModel.getWeeklyActivityModel(),
            adminModel.getTopSearchesModel()
        ]);

        res.status(200).json({
            global,
            categories,
            activity,
            searches
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
