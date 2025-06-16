import { Router } from 'express';
import {
  authGoogle,
  checkVerified,
  getUser,
  login,
  logout,
  register,
  registerSuccess,
  resendVerificationCode,
} from '../controllers/user';
import passport from '../config/passport';

const router: Router = Router();

router.post('/login', login);
router.post('/register', register);
router.post('/register-success', registerSuccess);
router.post('/resend-verification', resendVerificationCode);
router.post('/logout', logout);
router.get('/check-verified', checkVerified);
router.get('/get-user', getUser);

// Sends user to the select their mail.
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Works when user selects its mail.
router.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  authGoogle,
);

export default router;
