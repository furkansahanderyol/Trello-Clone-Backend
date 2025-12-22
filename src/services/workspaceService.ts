import { prisma } from '../lib/prisma';

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
    const sender = await prisma.user.findUnique({
      where: {
        id: invitedById,
      },
      select: {
        name: true,
        surname: true,
        profileImage: true,
      },
    });

    const workspace = await prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
      select: {
        name: true,
      },
    });

    if (!sender || !workspace) {
      throw new Error('Sender or workspace not found.');
    }

    const invites = await Promise.all(
      invitedUserIds.map(async (id) => {
        const invite = await prisma.workspaceInvite.create({
          data: {
            workspaceId,
            invitedUserId: id,
            invitedById,
          },
        });

        await prisma.notification.create({
          data: {
            type: 'workspace-invite',
            message,
            userId: id,
            senderId: invitedById,
            workspaceId: invite.workspaceId,
            senderName: sender.name,
            senderProfileImage: sender.profileImage,
            senderSurname: sender.surname,
            workspaceName: workspace.name,
          },
        });

        return invite;
      }),
    );

    return invites;
  }
}
