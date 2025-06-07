import { Router } from 'express';
import { checkVerified, login, logout, register, registerSuccess, resendVerificationCode } from '../controllers/user';

const router: Router = Router();

router.post('/login', login);
router.post('/register', register);
router.post('/register-success', registerSuccess);
router.post('/resend-verification', resendVerificationCode);
router.post('/logout', logout);
router.get('/check-verified', checkVerified);

export default router;
