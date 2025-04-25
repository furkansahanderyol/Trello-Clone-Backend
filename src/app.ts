import * as dotenv from 'dotenv';
import userRouter from './routes/user';
import express, { Application, Request, Response } from 'express';
import cors from 'cors';

dotenv.config();

const app: Application = express();
const port = 8000;

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World');
});

app.listen(port, () => {
  console.log(`Working on port ${port}`);
});

app.use(userRouter);
