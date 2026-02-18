import * as planModel from '../models/plan.model.js';

export const getPlans = async (req, res) => {
  try {
    const plans = await planModel.getPlansModel();
    res.status(200).json(plans);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updatePlan = async (req, res) => {
  try {
    const updated = await planModel.updatePlanModel(req.params.id, req.body);
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getPaymentHistory = async (req, res) => {
  try {
    const history = await planModel.getPaymentHistoryModel();
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
