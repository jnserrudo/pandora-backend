import { Router } from 'express';
import { createContactRequest } from '../controllers/contact.controller.js';

const router = Router();

router.post('/contact', createContactRequest);

export default router;
