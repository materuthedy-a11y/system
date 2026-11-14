import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateFeedbackDto, UpdateFeedbackStatusDto } from './dto';

const feedbackFields = {
  id: true,
  category: true,
  subject: true,
  message: true,
  pagePath: true,
  priority: true,
  assignedToId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

const feedbackMessageFields = {
  id: true,
  senderType: true,
  senderName: true,
  body: true,
  createdAt: true,
} as const;

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async createFeedback(businessId: string, userId: string, dto: CreateFeedbackDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, businessId, isActive: true },
      select: { firstName: true, lastName: true, email: true },
    });
    if (!user) throw new NotFoundException('Active account not found in this business');

    return this.prisma.$transaction(async (tx) => {
      const submission = await tx.feedbackSubmission.create({
        data: {
          businessId,
          submittedById: userId,
          submitterName: `${user.firstName} ${user.lastName}`.trim(),
          submitterEmail: user.email,
          category: dto.category,
          subject: dto.subject.trim(),
          message: dto.message.trim(),
          pagePath: dto.pagePath?.trim() || null,
          priority: dto.priority || 'NORMAL',
        },
        select: feedbackFields,
      });
      await tx.feedbackMessage.create({
        data: {
          businessId,
          submissionId: submission.id,
          senderId: userId,
          senderType: 'USER',
          senderName: `${user.firstName} ${user.lastName}`.trim(),
          senderEmail: user.email,
          body: dto.message.trim(),
        },
      });
      return submission;
    });
  }

  async listMyFeedback(businessId: string, userId: string) {
    return this.prisma.feedbackSubmission.findMany({
      where: { businessId, submittedById: userId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { ...feedbackFields, status: true },
    });
  }

  async listInbox(businessId: string) {
    return this.prisma.feedbackSubmission.findMany({
      where: { businessId },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: {
        ...feedbackFields,
        submitterName: true,
        submitterEmail: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async listAgents(businessId: string) {
    return this.prisma.user.findMany({
      where: {
        businessId,
        isActive: true,
        OR: [
          { permissions: { some: { key: 'settings.edit' } } },
          { userRoles: { some: { role: { permissions: { some: { key: 'settings.edit' } } } } } },
        ],
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, email: true },
    });
  }

  async listMessages(businessId: string, userId: string, submissionId: string) {
    await this.assertCanAccessSubmission(businessId, userId, submissionId);
    return this.prisma.feedbackMessage.findMany({
      where: { businessId, submissionId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: feedbackMessageFields,
    });
  }

  async addMessage(businessId: string, userId: string, submissionId: string, body: string) {
    const { submission, sender, isAdmin } = await this.assertCanAccessSubmission(
      businessId,
      userId,
      submissionId,
    );
    const message = body.trim();
    if (!message) throw new BadRequestException('Message cannot be empty');

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.feedbackMessage.create({
        data: {
          businessId,
          submissionId,
          senderId: sender.id,
          senderType: isAdmin ? 'ADMIN' : 'USER',
          senderName: `${sender.firstName} ${sender.lastName}`.trim(),
          senderEmail: sender.email,
          body: message,
        },
        select: feedbackMessageFields,
      });
      await tx.feedbackSubmission.update({
        where: { id: submission.id },
        data: {
          updatedAt: new Date(),
          ...(isAdmin && ['OPEN', 'WAITING_ON_USER'].includes(submission.status)
            ? { status: 'IN_PROGRESS' }
            : !isAdmin && ['WAITING_ON_USER', 'RESOLVED', 'CLOSED'].includes(submission.status)
              ? { status: 'OPEN' }
              : {}),
        },
      });
      return created;
    });
  }

  private async assertCanAccessSubmission(
    businessId: string,
    userId: string,
    submissionId: string,
  ) {
    const [submission, user] = await Promise.all([
      this.prisma.feedbackSubmission.findFirst({
        where: { id: submissionId, businessId },
        select: { id: true, submittedById: true, status: true },
      }),
      this.prisma.user.findFirst({
        where: { id: userId, businessId, isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          userRoles: { select: { role: { select: { permissions: { select: { key: true } } } } } },
          permissions: { select: { key: true } },
        },
      }),
    ]);
    if (!submission) throw new NotFoundException('Feedback submission not found');
    if (!user) throw new NotFoundException('Active account not found in this business');

    const hasManagePermission = [
      ...user.permissions.map(({ key }) => key),
      ...user.userRoles.flatMap(({ role }) => role.permissions.map(({ key }) => key)),
    ].includes('settings.edit');
    const isOwner = submission.submittedById === userId;
    if (!isOwner && !hasManagePermission) {
      throw new ForbiddenException('You do not have access to this feedback conversation');
    }
    return { submission, sender: user, isAdmin: hasManagePermission };
  }

  async updateStatus(businessId: string, id: string, dto: UpdateFeedbackStatusDto) {
    const result = await this.prisma.feedbackSubmission.updateMany({
      where: { id, businessId },
      data: { status: dto.status },
    });
    if (!result.count) throw new NotFoundException('Feedback submission not found');

    return this.prisma.feedbackSubmission.findFirstOrThrow({
      where: { id, businessId },
      select: {
        ...feedbackFields,
        submitterName: true,
        submitterEmail: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async updatePriority(businessId: string, id: string, priority: string) {
    const result = await this.prisma.feedbackSubmission.updateMany({
      where: { id, businessId },
      data: { priority },
    });
    if (!result.count) throw new NotFoundException('Feedback submission not found');
    return this.prisma.feedbackSubmission.findFirstOrThrow({
      where: { id, businessId },
      select: {
        ...feedbackFields,
        submitterName: true,
        submitterEmail: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async assign(businessId: string, id: string, userId?: string | null) {
    const submission = await this.prisma.feedbackSubmission.findFirst({
      where: { id, businessId },
      select: { id: true },
    });
    if (!submission) throw new NotFoundException('Feedback submission not found');
    if (userId) {
      const agent = await this.prisma.user.findFirst({
        where: {
          id: userId,
          businessId,
          isActive: true,
          OR: [
            { permissions: { some: { key: 'settings.edit' } } },
            { userRoles: { some: { role: { permissions: { some: { key: 'settings.edit' } } } } } },
          ],
        },
        select: { id: true },
      });
      if (!agent) throw new NotFoundException('Active help desk agent not found in this business');
    }
    await this.prisma.feedbackSubmission.update({
      where: { id },
      data: { assignedToId: userId || null },
    });
    return this.prisma.feedbackSubmission.findFirstOrThrow({
      where: { id, businessId },
      select: {
        ...feedbackFields,
        submitterName: true,
        submitterEmail: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }
}
