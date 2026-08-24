import cloudinary from '../config/cloudinary.config.js';

const FRIENDLY_UPLOAD_ERROR =
  'No se pudo subir la imagen. Probá JPG o PNG de hasta 10 MB.';

export const uploadImageController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se recibió ningún archivo.' });
    }

    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;

    // Upload simple: solo imagen a carpeta. Sin OCR / moderation / categorization.
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'pandora_app',
      resource_type: 'image',
    });

    return res.json({
      url: result.secure_url,
      imageUrl: result.secure_url,
    });
  } catch (error) {
    const raw = error?.message || String(error);
    console.error('[UPLOAD] Cloudinary:', raw);

    const looksLikeOcrOrAddon =
      /ocr|extraer el texto|extract.*text|addon|add-on/i.test(raw);

    return res.status(looksLikeOcrOrAddon ? 502 : 400).json({
      message: FRIENDLY_UPLOAD_ERROR,
    });
  }
};
