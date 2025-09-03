import { Router } from 'express';
import { createWorkspace, getAllWorkspaces, getWorkspace, inviteUsers } from '../controllers/workspace';

const router: Router = Router();

router.get('/get-all-workspaces', getAllWorkspaces);
router.post('/create-workspace', createWorkspace);
router.get('/get-workspace/:id', getWorkspace);
router.post('/invite-users', inviteUsers);

export default router;
