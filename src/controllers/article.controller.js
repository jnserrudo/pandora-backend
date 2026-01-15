import * as articleModel from '../models/article.model.js';

// --- CONTROLADORES PÚBLICOS ---

export const getArticles = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const sortBy = req.query.sortBy || 'recent';

        const { articles, total } = await articleModel.getAllPublishedArticlesModel({ page, limit, sortBy });
        
        res.status(200).json({
            articles,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const getArticleBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const article = await articleModel.getArticleBySlugModel(slug);
        res.status(200).json(article);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

// --- CONTROLADORES PROTEGIDOS (PARA ADMINS) ---

export const createArticle = async (req, res) => {
    try {
        const article = await articleModel.createArticleModel(req.body);
        res.status(201).json(article);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const updateArticle = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedArticle = await articleModel.updateArticleModel(id, req.body);
        res.status(200).json(updatedArticle);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const deleteArticle = async (req, res) => {
    try {
        const { id } = req.params;
        await articleModel.deleteArticleModel(id);
        res.status(204).send();
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};



export const getArticleCategories = async (req, res) => {
    try {
        const categories = await articleModel.getAllCategoriesModel();
        console.log(categories);
        res.status(200).json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getAllArticlesForAdmin = async (req, res) => {
    try {
        const articles = await articleModel.getAllArticlesForAdminModel();
        res.status(200).json(articles);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


export const createCategory = async (req, res, next) => {
    try {
        const newCategory = await articleModel.createCategoryModel(req.body);
        res.status(201).json(newCategory);
    } catch (error) { next(error) }
};

export const updateCategory = async (req, res, next) => {
    try {
        const updatedCategory = await articleModel.updateCategoryModel(req.params.id, req.body);
        res.status(200).json(updatedCategory);
    } catch (error) { next(error) }
};

export const deleteCategory = async (req, res, next) => {
    try {
        await articleModel.deleteCategoryModel(req.params.id);
        res.status(204).send();
    } catch (error) { next(error) }
};