import * as contactModel from '../models/contact.model.js';

export const createContactRequest = async (req, res) => {
    try {
        await contactModel.createContactRequestModel(req.body);
        res.status(200).json({
            success: true,
            message: "Tu mensaje fue recibido. Nos contactaremos pronto."
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
