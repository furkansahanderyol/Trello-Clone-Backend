import { Router } from 'express';
import {
  acceptWorkspaceInvite,
  createWorkspace,
  getAllWorkspaces,
  getWorkspace,
  getWorkspaceMembers,
  inviteUsers,
  removeWorkspaceMember,
} from '../controllers/workspace';

const router: Router = Router();

router.get('/get-all-workspaces', getAllWorkspaces);
router.post('/create-workspace', createWorkspace);
router.get('/get-workspace/:id', getWorkspace);
router.post('/invite-users', inviteUsers);
router.post('/accept-workspace-invite', acceptWorkspaceInvite);
router.get('/get-workspace-members/:id', getWorkspaceMembers);
router.post('/remove-workspace-member', removeWorkspaceMember);

export default router;
