import * as commerceModel from "../models/commerce.model.js";
export const createCommerce = async (req, res) => {
  try {
    res
      .status(201)
      .json(await commerceModel.createCommerceModel(req.body, req.user.id));
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};
export const getMyCommerce = async (req, res) => {
  try {
    res
      .status(200)
      .json(await commerceModel.getCommerceByOwnerModel(req.user.id));
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};
export const updateMyCommerce = async (req, res) => {
  try {
    res
      .status(200)
      .json(
        await commerceModel.updateCommerceByOwnerModel(req.user.id, req.body)
      );
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};
export const getCommerceById = async (req, res) => {
  try {
    res
      .status(200)
      .json(await commerceModel.getCommerceByIdModel(req.params.id));
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};
