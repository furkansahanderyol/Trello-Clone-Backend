import multer from 'multer';
import path from 'path';
import fs from 'fs';

const tempStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const taskId = req.query.taskId;

    if (!taskId) {
      return cb(new Error('Board ID is required'), '');
    }

    const uploadPath = path.join(__dirname, '../../temp_uploads', taskId as string);

    try {
      fs.mkdirSync(uploadPath, { recursive: true });
    } catch (err) {
      console.error('mkdir error:', err);
    }

    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  },
});

function fileFilter(req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are valid!'));
  }
}

const tempUpload = multer({
  storage: tempStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export default tempUpload;
