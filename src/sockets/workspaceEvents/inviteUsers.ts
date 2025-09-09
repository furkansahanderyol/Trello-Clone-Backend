import { PrismaClient } from '@prisma/client';
import { io, userSockets } from '..';

const prisma = new PrismaClient();

export async function inviteUsers(users: string) {
  const parsedUsers = JSON.parse(users) as { email: string }[];
  const userEmails = parsedUsers.map((user) => user.email);
  const findUsers = await prisma.user.findMany({
    where: { email: { in: userEmails } },
    select: { id: true, email: true },
  });

  if (!findUsers.length) {
    console.log('No users found.');
    return;
  }

  findUsers.forEach((user) => {
    const socketId = userSockets.get(user.email);

    if (socketId) {
      io.to(socketId).emit('invite_users', {
        message: 'You have a new invite',
        email: user.email,
      });
    }
  });

  return { invited: findUsers.map((u) => u.email) };
}
