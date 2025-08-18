import { Router } from 'express';
import {
  addTask,
  createBoard,
  getAllBoards,
  updateBoardOrders,
  updateBoardTasks,
  updateTaskName,
} from '../controllers/board';

const router: Router = Router();

router.get('/boards/:workspaceId', getAllBoards);
router.post('/create-board', createBoard);
router.patch('/update-board-tasks', updateBoardTasks);
router.patch('/update-board-orders', updateBoardOrders);
router.post('/add-task', addTask);
router.patch('/update-task', updateTaskName);

export default router;
