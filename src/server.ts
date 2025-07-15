import http from 'http';
import fs from 'fs';
import path from 'path';
import app from './app';
import setupWebSocketServer from './sockets';

const port = process.env.PORT || 8000;
const server = http.createServer(app);

setupWebSocketServer(server);

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

server.listen(port, () => {
  console.log(`Working on port ${port}`);
});
