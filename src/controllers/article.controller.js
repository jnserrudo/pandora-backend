import * as articleModel from "../models/article.model.js";
export const createArticle = async (req, res) => {
  try {
    res.status(201).json(await articleModel.createArticeModel(req.body));
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};
export const getAllArticles = async (req, res) => {
  try {
    res.status(200).json(await articleModel.getAllArticlesModel());
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};
export const getArticleBySlug = async (req, res) => {
  try {
    res
      .status(200)
      .json(await articleModel.getArticleBySlugModel(req.params.slug));
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};
export const updateArticle = async (req, res) => {
  try {
    res
      .status(200)
      .json(await articleModel.updateArticleModel(req.params.id, req.body));
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};
export const deleteArticle = async (req, res) => {
  try {
    await articleModel.deleteArticleModel(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};
