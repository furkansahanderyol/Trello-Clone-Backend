import { Server } from 'socket.io';
import http from 'http';
import { updateBoard } from './boardEvents/updateBoard';

export let io: Server;

export default function setupWebSocketServer(server: http.Server) {
  io = new Server(server, {
    cors: {
      origin: 'http://localhost:3000',
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    socket.on('connect', () => {
      console.log('a user connected');
    });

    socket.on('update_board', updateBoard);
  });
}
