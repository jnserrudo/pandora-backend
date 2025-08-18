import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// El SDK de Cloudinary detectará y usará automáticamente la variable
// de entorno CLOUDINARY_URL si está disponible.
// No es necesario llamar a cloudinary.config() manualmente.

// Si quieres ser explícito o si la detección automática falla, puedes hacerlo así:
// cloudinary.config({ 
//   secure: true 
// });
// O incluso pasar la URL directamente, aunque no es la práctica recomendada:
// cloudinary.config(process.env.CLOUDINARY_URL);

// Simplemente exportar el objeto cloudinary es suficiente.
export default cloudinary;