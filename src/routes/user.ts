import { Router } from 'express';
import { post, register } from '../controllers/user';

const router: Router = Router();

router.post('/login', post);
router.post('/register', register);

export default router;
