import * as submissionModel from '../models/submission.model.js';

export const createContactRequest = async (req, res) => {
    try {
        await submissionModel.createSubmissionModel({
            ...req.body,
            type: 'CONTACT'
        });
        res.status(200).json({
            success: true,
            message: "Tu mensaje fue recibido. Nos contactaremos pronto."
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
