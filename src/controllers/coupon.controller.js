import * as couponModel from '../models/coupon.model.js';

export const getCoupons = async (req, res) => {
  try {
    const showAll = req.query.all === 'true';
    const coupons = await couponModel.getCouponsModel(showAll);
    res.status(200).json(coupons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createCoupon = async (req, res) => {
  try {
    const created = await couponModel.createCouponModel(req.body);
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateCoupon = async (req, res) => {
  try {
    const updated = await couponModel.updateCouponModel(req.params.id, req.body);
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteCoupon = async (req, res) => {
  try {
    await couponModel.deleteCouponModel(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const validateCoupon = async (req, res) => {
  try {
    const coupon = await couponModel.validateCouponModel(req.body.code);
    if (!coupon) {
      return res.status(404).json({ message: "Cupón inválido o expirado." });
    }
    res.status(200).json(coupon);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
