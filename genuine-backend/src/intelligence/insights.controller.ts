import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Business } from '../common/decorators/business.decorator';
import { UserId } from '../common/decorators/auth.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { InsightsService } from './insights.service';
import {
  CreateDraftPurchaseOrdersDto,
  InsightActionDto,
  InsightFilterDto,
  ReorderSuggestionsQueryDto,
} from './dto/insight.dto';

@ApiTags('Intelligence')
@ApiBearerAuth()
@Controller('insights')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get('summary')
  @RequirePermission('insights.view')
  summary(@Business() businessId: string, @UserId() userId: string) {
    return this.insights.getSummary(businessId, userId);
  }

  @Get()
  @RequirePermission('insights.view')
  list(
    @Business() businessId: string,
    @UserId() userId: string,
    @Query() filter: InsightFilterDto,
  ) {
    return this.insights.listInsights(businessId, userId, filter);
  }

  @Get('reorder-suggestions')
  @RequirePermission('insights.view', 'inventory.view')
  reorderSuggestions(
    @Business() businessId: string,
    @UserId() userId: string,
    @Query() query: ReorderSuggestionsQueryDto,
  ) {
    return this.insights.getReorderSuggestions(businessId, userId, query);
  }

  @Post('reorder-suggestions/create-po')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('purchases.create')
  createDraftPurchaseOrders(
    @Business() businessId: string,
    @UserId() userId: string,
    @Body() dto: CreateDraftPurchaseOrdersDto,
  ) {
    return this.insights.createDraftPurchaseOrders(businessId, userId, dto);
  }

  @Post('run')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('insights.manage')
  run(@Business() businessId: string) {
    return this.insights.runDetection(businessId);
  }

  @Get(':id')
  @RequirePermission('insights.view')
  get(@Business() businessId: string, @UserId() userId: string, @Param('id') id: string) {
    return this.insights.getInsight(businessId, userId, id);
  }

  @Post(':id/acknowledge')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('insights.manage')
  acknowledge(
    @Business() businessId: string,
    @UserId() userId: string,
    @Param('id') id: string,
    @Body() dto: InsightActionDto,
  ) {
    return this.insights.acknowledge(businessId, userId, id, dto);
  }

  @Post(':id/dismiss')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('insights.manage')
  dismiss(
    @Business() businessId: string,
    @UserId() userId: string,
    @Param('id') id: string,
    @Body() dto: InsightActionDto,
  ) {
    return this.insights.dismiss(businessId, userId, id, dto);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('insights.manage')
  resolve(
    @Business() businessId: string,
    @UserId() userId: string,
    @Param('id') id: string,
    @Body() dto: InsightActionDto,
  ) {
    return this.insights.resolve(businessId, userId, id, dto);
  }
}
