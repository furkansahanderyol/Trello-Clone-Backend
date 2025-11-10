import { Router } from 'express';
import {
  addMemberToTask,
  createWorkspaceLabel,
  deleteTaskComment,
  deleteWorkspaceLabel,
  editWorkspaceLabel,
  getAvailableTaskMembers,
  getTaskData,
  getTaskLabelsWithStatus,
  getWorkspaceLabels,
  taskComment,
  toggleTaskLabel,
  updateTaskComment,
  uploadTaskDescription,
  uploadTaskImage,
} from '../controllers/task';
import tempUpload from '../middlewares/tempUpload';

const router: Router = Router();

router.post('/get-task-data', getTaskData);
router.post('/upload-task-image', tempUpload.array('files', 10), uploadTaskImage);
router.patch('/upload-task-description', uploadTaskDescription);
router.post('/task-comment', taskComment);
router.post('/delete-task-comment', deleteTaskComment);
router.patch('/update-task-comment', updateTaskComment);
router.post('/get-task-labels', getWorkspaceLabels);
router.post('/create-task-label', createWorkspaceLabel);
router.patch('/edit-task-label', editWorkspaceLabel);
router.post('/delete-task-label', deleteWorkspaceLabel);
router.post('/get-label-status', getTaskLabelsWithStatus);
router.post('/toggle-label-status', toggleTaskLabel);
router.post('/add-member-to-task', addMemberToTask);
router.get('/available-task-members/:workspaceId/:taskId', getAvailableTaskMembers);

export default router;
