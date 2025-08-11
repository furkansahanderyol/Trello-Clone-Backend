import fs from 'fs';
import path from 'path';

export function changeFileLocation(source: string, target: string) {
  const projectRoot = path.resolve(__dirname, '..', '..');
  const oldLocation = path.join(projectRoot, 'temp_uploads', source);
  const parts = source.split('/');
  const boardId = parts[0];

  const fileName = parts[parts.length - 1];
  const uploadDir = path.join(projectRoot, target, boardId);

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const newLocation = path.join(uploadDir, fileName);

  return new Promise<void>((resolve, reject) => {
    if (fs.existsSync(newLocation)) {
      resolve();
      return;
    }

    fs.rename(oldLocation, newLocation, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
