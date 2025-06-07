import * as dotenv from 'dotenv';
import userRouter from './routes/user';
import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

dotenv.config();

const app: Application = express();
const port = 8000;

app.use(
  cors({
    origin: 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.listen(port, () => {
  console.log(`Working on port ${port}`);
});

app.use(userRouter);
