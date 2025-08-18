import cloudinary from '../config/cloudinary.config.js';

export const uploadImageController = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }

        // Cloudinary necesita un string base64, lo convertimos del buffer
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        let dataURI = 'data:' + req.file.mimetype + ';base64,' + b64;
        
        // Subimos a Cloudinary
        const result = await cloudinary.uploader.upload(dataURI, {
            folder: 'pandora_app', // Opcional: para organizar en una carpeta
        });

        // Devolvemos la URL segura
        return res.json({ imageUrl: result.secure_url });

    } catch (error) {
        next(error);
    }
};