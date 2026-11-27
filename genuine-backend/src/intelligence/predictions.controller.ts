import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Business } from '../common/decorators/business.decorator';
import { UserId } from '../common/decorators/auth.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { PredictionsService } from './predictions.service';

@ApiTags('Intelligence')
@ApiBearerAuth()
@Controller('insights/predictions')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PredictionsController {
  constructor(private readonly predictions: PredictionsService) {}

  @Get('demand/:productId')
  @RequirePermission('insights.view')
  demand(
    @Business() businessId: string,
    @UserId() userId: string,
    @Param('productId') productId: string,
    @Query('locationId') locationId?: string,
    @Query('horizon') horizon?: string,
  ) {
    return this.predictions.demandForecast(
      businessId,
      userId,
      productId,
      locationId || null,
      Number(horizon) || 30,
    );
  }

  @Get('stockout')
  @RequirePermission('insights.view')
  stockout(@Business() businessId: string, @UserId() userId: string) {
    return this.predictions.stockoutForecasts(businessId, userId);
  }

  @Get('overstock')
  @RequirePermission('insights.view')
  overstock(@Business() businessId: string, @UserId() userId: string) {
    return this.predictions.overstockForecasts(businessId, userId);
  }

  @Get('churn')
  @RequirePermission('insights.view')
  churn(@Business() businessId: string, @UserId() userId: string) {
    return this.predictions.churnForecasts(businessId, userId);
  }

  @Get('cashflow')
  @RequirePermission('insights.view')
  cashflow(@Business() businessId: string, @UserId() userId: string, @Query('days') days?: string) {
    return this.predictions.cashflowForecast(businessId, userId, Number(days) || 30);
  }
}
