import { Router } from 'express';
import { login, register, registerSuccess, resendVerificationCode } from '../controllers/user';

const router: Router = Router();

router.post('/login', login);
router.post('/register', register);
router.post('/register-success', registerSuccess);
router.post('/resend-verification', resendVerificationCode);

export default router;
