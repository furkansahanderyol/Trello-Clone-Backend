import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class workspaceService {
  workspaceId: string;
  invitedUserIds: string[];
  invitedById: string;
  message: string;

  constructor(workspaceId: string, invitedUserIds: string[], invitedById: string, message: string) {
    this.workspaceId = workspaceId;
    this.invitedUserIds = invitedUserIds;
    this.invitedById = invitedById;
    this.message = message;
  }

  static async inviteUsers(workspaceId: string, invitedUserIds: string[], invitedById: string, message: string) {
    const invites = await Promise.all(
      invitedUserIds.map(async (id) => {
        const invite = await prisma.workspaceInvite.create({
          data: {
            workspaceId,
            invitedUserId: id,
            invitedById,
          },
        });

        if (message) {
          await prisma.notification.create({
            data: {
              type: 'workspace-invite',
              message,
              userId: id,
              senderId: invitedById,
            },
          });
        }

        return invite;
      }),
    );

    return invites;
  }
}
