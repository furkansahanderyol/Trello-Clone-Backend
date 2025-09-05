import { PrismaClient } from '@prisma/client';
import { io } from '..';

const prisma = new PrismaClient();

export async function inviteUser() {
  return io.emit('invite-user', '');
}
