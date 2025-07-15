import { Server } from 'socket.io';
import http from 'http';

export default function setupWebSocketServer(server: http.Server) {
  const io = new Server(server, {
    cors: {
      origin: 'http://localhost:3000',
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('send_text', (text: string) => {
      console.log(`Incoming Message: ${text}`);

      socket.broadcast.emit('receive_text', text);
    });
  });
}
