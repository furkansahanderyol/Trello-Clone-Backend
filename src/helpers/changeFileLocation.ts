import fs from 'fs';
import path from 'path';

export function changeFileLocation(source: string, target: string) {
  const projectRoot = path.resolve(__dirname, '..', '..');
  const oldLocation = path.join(projectRoot, 'temp_uploads', source);
  const parts = source.split('/');
  const taskId = parts[0];

  const fileName = parts[parts.length - 1];
  const uploadDir = path.join(projectRoot, target, taskId);

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const newLocation = path.join(uploadDir, fileName);

  return new Promise<void>((resolve, reject) => {
    if (fs.existsSync(newLocation) || !fs.existsSync(oldLocation)) {
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
