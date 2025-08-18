import { Router } from 'express';
import { createWorkspace, getAllWorkspaces, getWorkspace } from '../controllers/workspace';

const router: Router = Router();

router.get('/get-all-workspaces', getAllWorkspaces);
router.post('/create-workspace', createWorkspace);
router.get('/get-workspace/:id', getWorkspace);

export default router;
