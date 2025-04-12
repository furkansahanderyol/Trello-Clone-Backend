import { Router } from 'express';
import { post } from '../controllers/user';

const router: Router = Router();

router.post('/login', post);

export default router;
