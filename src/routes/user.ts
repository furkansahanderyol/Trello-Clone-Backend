import { Router } from 'express';
import {
  authGoogle,
  changePassword,
  checkVerified,
  getUser,
  login,
  logout,
  register,
  registerSuccess,
  resendVerificationCode,
  updateProfileImage,
} from '../controllers/user';
import passport from '../config/passport';
import upload from '../middlewares/upload';
import { createWorkspace, getAllWorkspaces, getWorkspace } from '../controllers/workspace';
import { addTask, createBoard, getAllBoards, updateBoard, updateTaskName } from '../controllers/board';

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

// Sends user to the select their mail.
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Works when user selects its mail.
router.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  authGoogle,
);

router.post('/upload-profile-image', upload.single('profileImage'), updateProfileImage);

// Workspace endpoints
router.get('/get-all-workspaces', getAllWorkspaces);
router.post('/create-workspace', createWorkspace);
router.get('/get-workspace/:id', getWorkspace);

// Board endpoints
router.get('/boards/:workspaceId', getAllBoards);
router.post('/create-board', createBoard);
router.patch('/update-board', updateBoard);
router.post('/add-task', addTask);
router.patch('/update-task', updateTaskName);

export default router;
