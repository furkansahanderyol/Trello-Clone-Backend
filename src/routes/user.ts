import { Router } from 'express';
import {
  authGoogle,
  changePassword,
  checkVerified,
  getUser,
  getUserNotifications,
  login,
  logout,
  markNotificationAsRead,
  register,
  registerSuccess,
  resendVerificationCode,
  searchUser,
  updateProfileImage,
} from '../controllers/user';
import passport from '../config/passport';
import upload from '../middlewares/upload';

const router: Router = Router();

// User endpoints
router.post('/login', login);
router.post('/register', register);
router.post('/register-success', registerSuccess);
router.post('/resend-verification', resendVerificationCode);
router.post('/logout', logout);
router.get('/check-verified', checkVerified);
router.get('/get-user', getUser);
router.post('/change-password', changePassword);
router.post('/search-user', searchUser);
router.get('/user-notifications', getUserNotifications);
router.patch('/notifications/read/:notificationId', markNotificationAsRead);

// Sends user to the select their mail.
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Works when user selects its mail.
router.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  authGoogle,
);

router.post('/upload-profile-image', upload.single('profileImage'), updateProfileImage);

export default router;
