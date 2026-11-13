import {
  Body,
  Controller,
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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import {
  CreatePhysicalCountDto,
  CreateStockAdjustmentDto,
  CreateStockTransferDto,
  ExpiryReportDto,
  InventoryMovementReportDto,
  LowStockReportDto,
  ReceiveStockTransferDto,
  RejectInventoryDto,
  InventoryListQueryDto,
  StockBalanceQueryDto,
  StockAgeingReportDto,
  StockValuationReportDto,
  ReorderPointQueryDto,
  UpdateReorderPointDto,
} from './dto';
import { InventoryService } from './inventory.service';

@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('inventory')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('balances')
  @RequirePermission('inventory.view')
  @ApiOperation({ summary: 'List current stock balances by product and location' })
  balances(@Business() businessId: string, @UserId() userId: string, @Query() filter: StockBalanceQueryDto) {
    return this.inventory.getStockBalances(businessId, userId, filter);
  }

  @Get('options')
  @RequirePermission('inventory.view')
  options(@Business() businessId: string, @UserId() userId: string) {
    return this.inventory.getInventoryOptions(businessId, userId);
  }

  @Get('reorder-points')
  @RequirePermission('inventory.view')
  reorderPoints(@Business() businessId: string, @UserId() userId: string, @Query() filter: ReorderPointQueryDto) {
    return this.inventory.getReorderPoints(businessId, userId, filter);
  }

  @Patch('reorder-points/:productId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('inventory.adjust')
  updateReorderPoints(
    @Business() businessId: string,
    @UserId() userId: string,
    @Param('productId') productId: string,
    @Body() dto: UpdateReorderPointDto,
  ) {
    return this.inventory.updateReorderPoint(businessId, userId, productId, dto);
  }

  @Get('adjustments')
  @RequirePermission('inventory.view')
  listAdjustments(@Business() businessId: string, @UserId() userId: string, @Query() filter: InventoryListQueryDto) {
    return this.inventory.listStockAdjustments(businessId, userId, filter);
  }

  @Post('adjustments')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('inventory.adjust')
  @ApiOperation({ summary: 'Create a pending stock adjustment' })
  createAdjustment(
    @Business() businessId: string,
    @UserId() userId: string,
    @Body() dto: CreateStockAdjustmentDto,
  ) {
    return this.inventory.createStockAdjustment(businessId, userId, dto);
  }

  @Get('transfers')
  @RequirePermission('inventory.view')
  listTransfers(@Business() businessId: string, @UserId() userId: string, @Query() filter: InventoryListQueryDto) {
    return this.inventory.listStockTransfers(businessId, userId, filter);
  }

  @Get('adjustments/:id')
  @RequirePermission('inventory.view')
  getAdjustment(@Business() businessId: string, @UserId() userId: string, @Param('id') id: string) {
    return this.inventory.getStockAdjustmentById(businessId, id, userId);
  }

  @Post('adjustments/:id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('inventory.adjust')
  approveAdjustment(
    @Business() businessId: string,
    @UserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.inventory.approveStockAdjustment(businessId, id, userId);
  }

  @Post('adjustments/:id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('inventory.adjust')
  rejectAdjustment(
    @Business() businessId: string,
    @UserId() userId: string,
    @Param('id') id: string,
    @Body() dto: RejectInventoryDto,
  ) {
    return this.inventory.rejectStockAdjustment(businessId, id, userId, dto.reason);
  }

  @Post('transfers')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('inventory.transfer')
  createTransfer(
    @Business() businessId: string,
    @UserId() userId: string,
    @Body() dto: CreateStockTransferDto,
  ) {
    return this.inventory.createStockTransfer(businessId, userId, dto);
  }

  @Get('counts')
  @RequirePermission('inventory.view')
  listCounts(@Business() businessId: string, @UserId() userId: string, @Query() filter: InventoryListQueryDto) {
    return this.inventory.listPhysicalCounts(businessId, userId, filter);
  }

  @Get('transfers/:id')
  @RequirePermission('inventory.view')
  getTransfer(@Business() businessId: string, @UserId() userId: string, @Param('id') id: string) {
    return this.inventory.getStockTransferById(businessId, id, userId);
  }

  @Post('transfers/:id/send')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('inventory.transfer')
  sendTransfer(@Business() businessId: string, @UserId() userId: string, @Param('id') id: string) {
    return this.inventory.sendStockTransfer(businessId, id, userId);
  }

  @Post('transfers/:id/receive')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('inventory.transfer')
  receiveTransfer(
    @Business() businessId: string,
    @UserId() userId: string,
    @Param('id') id: string,
    @Body() dto: ReceiveStockTransferDto,
  ) {
    return this.inventory.receiveStockTransfer(businessId, id, userId, dto?.receivedQuantities);
  }

  @Post('counts')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('inventory.adjust')
  createCount(
    @Business() businessId: string,
    @UserId() userId: string,
    @Body() dto: CreatePhysicalCountDto,
  ) {
    return this.inventory.createPhysicalCount(businessId, userId, dto);
  }

  @Get('counts/:id')
  @RequirePermission('inventory.view')
  getCount(@Business() businessId: string, @UserId() userId: string, @Param('id') id: string) {
    return this.inventory.getPhysicalCountById(businessId, id, userId);
  }

  @Post('counts/:id/complete')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('inventory.adjust')
  completeCount(@Business() businessId: string, @UserId() userId: string, @Param('id') id: string) {
    return this.inventory.completePhysicalCount(businessId, id, userId);
  }

  @Post('counts/:id/post')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('inventory.adjust')
  postCount(@Business() businessId: string, @UserId() userId: string, @Param('id') id: string) {
    return this.inventory.postPhysicalCount(businessId, id, userId);
  }

  @Get('reports/valuation')
  @RequirePermission('inventory.view')
  valuation(@Business() businessId: string, @UserId() userId: string, @Query() filter: StockValuationReportDto) {
    return this.inventory.getStockValuationReport(businessId, userId, filter);
  }

  @Get('reports/low-stock')
  @RequirePermission('inventory.view')
  lowStock(@Business() businessId: string, @UserId() userId: string, @Query() filter: LowStockReportDto) {
    return this.inventory.getLowStockReport(businessId, userId, filter);
  }

  @Get('reports/expiry')
  @RequirePermission('inventory.view')
  expiry(@Business() businessId: string, @UserId() userId: string, @Query() filter: ExpiryReportDto) {
    return this.inventory.getStockExpiryReport(businessId, userId, filter);
  }

  @Get('reports/ageing')
  @RequirePermission('inventory.view')
  ageing(@Business() businessId: string, @UserId() userId: string, @Query() filter: StockAgeingReportDto) {
    return this.inventory.getStockAgeingReport(businessId, userId, filter);
  }

  @Get('reports/movements')
  @RequirePermission('inventory.view')
  movements(@Business() businessId: string, @UserId() userId: string, @Query() filter: InventoryMovementReportDto) {
    return this.inventory.getInventoryMovementReport(businessId, userId, filter);
  }

  @Get('dashboard')
  @RequirePermission('inventory.view')
  @ApiOperation({ summary: 'Get inventory KPIs and recent movements' })
  dashboard(@Business() businessId: string) {
    return this.inventory.getInventoryDashboard(businessId);
  }
}
