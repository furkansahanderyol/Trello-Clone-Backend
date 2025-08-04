import multer from 'multer';
import path from 'path';

const tempStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'temp_uploads');
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
    cb(new Error('Sadece resim dosyalarına izin verilir!'));
  }
}

const tempUpload = multer({
  storage: tempStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export default tempUpload;
