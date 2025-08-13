import * as articleModel from '../models/article.model.js';

// --- CONTROLADORES PÚBLICOS ---

export const getArticles = async (req, res) => {
    try {
        const articles = await articleModel.getAllPublishedArticlesModel();
        res.status(200).json(articles);
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