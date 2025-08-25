import { Router } from 'express';
import {
  createTaskLabel,
  deleteTaskComment,
  deleteTaskLabel,
  editTaskLabel,
  getTaskData,
  getTaskLabels,
  taskComment,
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
router.post('/get-task-labels', getTaskLabels);
router.post('/create-task-label', createTaskLabel);
router.patch('/edit-task-label', editTaskLabel);
router.post('/delete-task-label', deleteTaskLabel);

export default router;
