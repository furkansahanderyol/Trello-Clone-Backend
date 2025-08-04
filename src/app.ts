import * as dotenv from 'dotenv';
import userRouter from './routes/user';
import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import './config/passport';
import session from 'express-session';
import passport from './config/passport';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app: Application = express();
const uploadDir = path.join(process.cwd(), 'uploads');
const tempUploadDir = path.join(process.cwd(), 'temp_uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true });
}

app.use(
  cors({
    origin: 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Session created for passport.serializeUser and passport.deserializeUser functions.
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
  }),
);

// Sends file to the browser
const uploadsPath = path.resolve(process.cwd(), 'uploads');
const tempUploadsPath = path.resolve(process.cwd(), 'temp_uploads');
app.use('/uploads', express.static(uploadsPath));
app.use('/temp_uploads', express.static(tempUploadsPath));

app.use(passport.initialize());
app.use(passport.session());

app.use(userRouter);

export default app;
