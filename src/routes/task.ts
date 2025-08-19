import { Router } from 'express';
import {
  deleteTaskComment,
  getTaskData,
  taskComment,
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

export default router;
