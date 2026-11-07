import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Business } from '../common/decorators/business.decorator';
import { UserId } from '../common/decorators/auth.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { JwtAuthGuard, PermissionGuard } from '../common/guards';
import {
  CreateNotificationDto,
  CreateNotificationTemplateDto,
  EmailConfigDto,
  InboxQueryDto,
  NotificationListQueryDto,
  NotificationTemplateQueryDto,
  RetryNotificationDto,
  SMSConfigDto,
  TestSMSConfigDto,
  UpdateNotificationTemplateDto,
  UpdateInAppPreferenceDto,
} from './dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('templates')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('settings.edit')
  @ApiOperation({ summary: 'Create a business notification template' })
  createTemplate(@Business() businessId: string, @Body() dto: CreateNotificationTemplateDto) {
    return this.notifications.createTemplate(businessId, dto);
  }

  @Get('templates')
  @RequirePermission('settings.view', 'settings.edit')
  getTemplates(@Business() businessId: string, @Query() filter: NotificationTemplateQueryDto) {
    return this.notifications.getAllTemplates(businessId, filter);
  }

  @Get('templates/:id')
  @RequirePermission('settings.view', 'settings.edit')
  getTemplate(@Business() businessId: string, @Param('id') id: string) {
    return this.notifications.getTemplateById(businessId, id);
  }

  @Patch('templates/:id')
  @RequirePermission('settings.edit')
  updateTemplate(
    @Business() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateNotificationTemplateDto,
  ) {
    return this.notifications.updateTemplate(businessId, id, dto);
  }

  @Delete('templates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('settings.edit')
  deleteTemplate(@Business() businessId: string, @Param('id') id: string) {
    return this.notifications.deleteTemplate(businessId, id);
  }

  @Post('send')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('settings.edit')
  @ApiOperation({ summary: 'Create an email, SMS, or in-app notification' })
  createNotification(@Business() businessId: string, @Body() dto: CreateNotificationDto) {
    return this.notifications.createNotification(businessId, dto);
  }

  @Post(':id/send-now')
  @RequirePermission('settings.edit')
  sendNow(@Business() businessId: string, @Param('id') id: string) {
    return this.notifications.sendNotificationNow(businessId, id);
  }

  @Post('process-pending')
  @RequirePermission('settings.edit')
  processPending(@Business() businessId: string, @Body() dto: RetryNotificationDto) {
    return this.notifications.processNow(businessId, dto.limit);
  }

  @Get('inbox/in-app')
  getInAppInbox(
    @Business() businessId: string,
    @UserId() userId: string,
    @Query() filter: InboxQueryDto,
  ) {
    return this.notifications.getInAppNotifications(businessId, userId, filter);
  }

  @Patch('inbox/in-app/:id/read')
  markAsRead(@Business() businessId: string, @UserId() userId: string, @Param('id') id: string) {
    return this.notifications.markAsRead(businessId, userId, id);
  }

  @Patch('inbox/in-app/read-all')
  markAllAsRead(@Business() businessId: string, @UserId() userId: string) {
    return this.notifications.markAllAsRead(businessId, userId);
  }

  @Patch('inbox/in-app/:id/archive')
  archiveInApp(@Business() businessId: string, @UserId() userId: string, @Param('id') id: string) {
    return this.notifications.archiveInAppNotification(businessId, userId, id);
  }

  @Patch('inbox/in-app/:id/restore')
  restoreInApp(@Business() businessId: string, @UserId() userId: string, @Param('id') id: string) {
    return this.notifications.restoreInAppNotification(businessId, userId, id);
  }

  @Delete('inbox/in-app/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteInboxEntry(@Business() businessId: string, @UserId() userId: string, @Param('id') id: string) {
    return this.notifications.deleteInAppInboxEntry(businessId, userId, id);
  }

  @Get('preferences/in-app')
  getInAppPreferences(@Business() businessId: string, @UserId() userId: string) {
    return this.notifications.getInAppPreferences(businessId, userId);
  }

  @Patch('preferences/in-app')
  updateInAppPreference(
    @Business() businessId: string,
    @UserId() userId: string,
    @Body() dto: UpdateInAppPreferenceDto,
  ) {
    return this.notifications.updateInAppPreference(businessId, userId, dto);
  }

  @Get('config/email')
  @RequirePermission('settings.view', 'settings.edit')
  getEmailConfig(@Business() businessId: string) {
    return this.notifications.getEmailConfig(businessId);
  }

  @Get('config/sms')
  @RequirePermission('settings.view', 'settings.edit')
  getSmsConfig(@Business() businessId: string) {
    return this.notifications.getSmsConfig(businessId);
  }

  @Get()
  @RequirePermission('settings.view')
  list(@Business() businessId: string, @Query() filter: NotificationListQueryDto) {
    return this.notifications.getAllNotifications(businessId, filter);
  }

  @Get(':id')
  @RequirePermission('settings.view')
  getOne(@Business() businessId: string, @Param('id') id: string) {
    return this.notifications.getNotificationById(businessId, id);
  }

  @Post('config/email')
  @RequirePermission('settings.edit')
  setEmailConfig(@Business() businessId: string, @Body() dto: EmailConfigDto) {
    return this.notifications.setEmailConfig(businessId, dto);
  }

  @Post('config/sms')
  @RequirePermission('settings.edit')
  setSmsConfig(@Business() businessId: string, @UserId() userId: string, @Body() dto: SMSConfigDto) {
    return this.notifications.setSmsConfig(businessId, userId, dto);
  }

  @Post('config/sms/test')
  @RequirePermission('settings.edit')
  testSmsConfig(@Business() businessId: string, @UserId() userId: string, @Body() dto: TestSMSConfigDto) {
    return this.notifications.sendTestSms(businessId, userId, dto);
  }
}
