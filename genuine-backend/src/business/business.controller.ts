import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Business } from '../common/decorators/business.decorator';
import { UserId } from '../common/decorators/auth.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { BusinessService } from './business.service';
import {
  BusinessSetupDto,
  UpdateBusinessProfileDto,
  BusinessProfileResponseDto,
  CreateLocationDto,
  UpdateLocationDto,
  LocationResponseDto,
  CreatePaymentMethodDto,
  UpdatePaymentMethodDto,
  UpdateBusinessSettingsDto,
  TaxRateDto,
  PaymentMethodResponseDto,
  CreateExpenseCategoryDto,
  ExpenseCategoryResponseDto,
  BusinessSetupResponseDto,
  CreateManagedUserDto,
  UpdateManagedUserDto,
  ResetManagedUserPasswordDto,
  CreateRoleDto,
  UpdateRoleDto,
} from './dto';

@ApiTags('Business Setup')
@Controller('business')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class BusinessController {
  constructor(private businessService: BusinessService) {}

  @Post('setup')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('settings.edit')
  @ApiOperation({ summary: 'Setup new business (first-run wizard)' })
  @ApiResponse({ status: 201, type: BusinessSetupResponseDto })
  async setupBusiness(
    @Business() businessId: string,
    @UserId() userId: string,
    @Body() dto: BusinessSetupDto,
  ): Promise<BusinessSetupResponseDto> {
    return this.businessService.setupBusiness(businessId, userId, dto);
  }

  @Get('brand')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get the signed-in business name and logo for workspace identity' })
  @ApiResponse({ status: 200, schema: { example: { name: 'Example Business', logoUrl: 'https://example.com/logo.webp' } } })
  async getBusinessBrand(@Business() businessId: string) {
    return this.businessService.getBusinessBrand(businessId);
  }

  @Get('profile')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('settings.view')
  @ApiOperation({ summary: 'Get business profile' })
  @ApiResponse({ status: 200, type: BusinessProfileResponseDto })
  async getBusinessProfile(@Business() businessId: string): Promise<BusinessProfileResponseDto> {
    return this.businessService.getBusinessProfile(businessId);
  }

  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('settings.edit')
  @ApiOperation({ summary: 'Update business profile' })
  @ApiResponse({ status: 200, type: BusinessProfileResponseDto })
  async updateBusinessProfile(
    @Business() businessId: string,
    @UserId() userId: string,
    @Body() dto: UpdateBusinessProfileDto,
  ): Promise<BusinessProfileResponseDto> {
    return this.businessService.updateBusinessProfile(businessId, userId, dto);
  }

  @Get('setup-status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('settings.view')
  @ApiOperation({ summary: 'Get setup status' })
  @ApiResponse({ status: 200 })
  async getSetupStatus(@Business() businessId: string) {
    return this.businessService.getSetupStatus(businessId);
  }

  @Get('settings')
  @RequirePermission('settings.view')
  getBusinessSettings(@Business() businessId: string) {
    return this.businessService.getBusinessSettings(businessId);
  }

  @Patch('settings')
  @RequirePermission('settings.edit')
  updateBusinessSettings(@Business() businessId: string, @UserId() userId: string, @Body() dto: UpdateBusinessSettingsDto) {
    return this.businessService.updateBusinessSettings(businessId, userId, dto);
  }

  @Get('users')
  @RequirePermission('users.view', 'roles.manage')
  listManagedUsers(@Business() businessId: string, @Query('roleId') roleId?: string, @Query('status') status?: string) {
    return this.businessService.listManagedUsers(businessId, roleId, status);
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('users.create')
  createManagedUser(@Business() businessId: string, @UserId() userId: string, @Body() dto: CreateManagedUserDto) {
    return this.businessService.createManagedUser(businessId, userId, dto);
  }

  @Patch('users/:id')
  @RequirePermission('users.edit')
  updateManagedUser(@Business() businessId: string, @UserId() userId: string, @Param('id') id: string, @Body() dto: UpdateManagedUserDto) {
    return this.businessService.updateManagedUser(businessId, userId, id, dto);
  }

  @Delete('users/:id')
  @RequirePermission('users.delete')
  deactivateManagedUser(@Business() businessId: string, @UserId() userId: string, @Param('id') id: string) {
    return this.businessService.deactivateManagedUser(businessId, userId, id);
  }

  @Post('users/:id/reset-password')
  @RequirePermission('users.edit')
  resetManagedUserPassword(@Business() businessId: string, @UserId() userId: string, @Param('id') id: string, @Body() dto: ResetManagedUserPasswordDto) {
    return this.businessService.resetManagedUserPassword(businessId, userId, id, dto);
  }

  @Get('roles')
  @RequirePermission('roles.manage', 'users.view')
  listRoles(@Business() businessId: string) {
    return this.businessService.listRoles(businessId);
  }

  @Get('permissions')
  @RequirePermission('roles.manage')
  listPermissions(@Business() businessId: string) {
    return this.businessService.listPermissions(businessId);
  }

  @Post('roles')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('roles.manage')
  createRole(@Business() businessId: string, @UserId() userId: string, @Body() dto: CreateRoleDto) {
    return this.businessService.createRole(businessId, userId, dto);
  }

  @Patch('roles/:id')
  @RequirePermission('roles.manage')
  updateRole(@Business() businessId: string, @UserId() userId: string, @Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.businessService.updateRole(businessId, userId, id, dto);
  }

  @Delete('roles/:id')
  @RequirePermission('roles.manage')
  deleteRole(@Business() businessId: string, @UserId() userId: string, @Param('id') id: string) {
    return this.businessService.deleteRole(businessId, userId, id);
  }

  @Get('tax-rates')
  @RequirePermission('settings.view')
  listTaxRates(@Business() businessId: string) {
    return this.businessService.listTaxRates(businessId);
  }

  @Post('tax-rates')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('settings.edit')
  createTaxRate(@Business() businessId: string, @UserId() userId: string, @Body() dto: TaxRateDto) {
    return this.businessService.createTaxRate(businessId, userId, dto);
  }

  @Patch('tax-rates/:id')
  @RequirePermission('settings.edit')
  updateTaxRate(@Business() businessId: string, @UserId() userId: string, @Param('id') id: string, @Body() dto: TaxRateDto) {
    return this.businessService.updateTaxRate(businessId, userId, id, dto);
  }

  @Delete('tax-rates/:id')
  @RequirePermission('settings.edit')
  deleteTaxRate(@Business() businessId: string, @UserId() userId: string, @Param('id') id: string) {
    return this.businessService.deleteTaxRate(businessId, userId, id);
  }

  @Post('locations')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('settings.edit')
  @ApiOperation({ summary: 'Create location' })
  @ApiResponse({ status: 201, type: LocationResponseDto })
  async createLocation(
    @Business() businessId: string,
    @UserId() userId: string,
    @Body() dto: CreateLocationDto,
  ): Promise<LocationResponseDto> {
    return this.businessService.createLocation(businessId, userId, dto);
  }

  @Get('locations')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('settings.view')
  @ApiOperation({ summary: 'Get all locations' })
  @ApiResponse({ status: 200, type: [LocationResponseDto] })
  async getLocations(
    @Business() businessId: string,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<LocationResponseDto[]> {
    return this.businessService.getLocations(businessId, includeInactive === 'true');
  }

  @Get('location-options')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(
    'sales.view', 'sales.create', 'sales.edit',
    'purchases.view', 'purchases.create',
    'inventory.view', 'products.view', 'settings.view',
  )
  @ApiOperation({ summary: 'Get active locations for the current workspace' })
  @ApiResponse({ status: 200 })
  async getLocationOptions(@Business() businessId: string) {
    return this.businessService.getLocationOptions(businessId);
  }

  @Patch('locations/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('settings.edit')
  @ApiOperation({ summary: 'Update location' })
  @ApiResponse({ status: 200, type: LocationResponseDto })
  async updateLocation(
    @Business() businessId: string,
    @Param('id') locationId: string,
    @UserId() userId: string,
    @Body() dto: UpdateLocationDto,
  ): Promise<LocationResponseDto> {
    return this.businessService.updateLocation(businessId, locationId, userId, dto);
  }

  @Post('payment-methods')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('settings.edit')
  @ApiOperation({ summary: 'Create payment method' })
  @ApiResponse({ status: 201, type: PaymentMethodResponseDto })
  async createPaymentMethod(
    @Business() businessId: string,
    @UserId() userId: string,
    @Body() dto: CreatePaymentMethodDto,
  ): Promise<PaymentMethodResponseDto> {
    return this.businessService.createPaymentMethod(businessId, userId, dto);
  }

  @Get('payment-methods')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('settings.view')
  @ApiOperation({ summary: 'Get all payment methods' })
  @ApiResponse({ status: 200, type: [PaymentMethodResponseDto] })
  async getPaymentMethods(
    @Business() businessId: string,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<PaymentMethodResponseDto[]> {
    return this.businessService.getPaymentMethods(businessId, includeInactive === 'true');
  }

  @Patch('payment-methods/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('settings.edit')
  @ApiOperation({ summary: 'Update or deactivate a payment method without deleting its history' })
  async updatePaymentMethod(
    @Business() businessId: string,
    @UserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentMethodDto,
  ): Promise<PaymentMethodResponseDto> {
    return this.businessService.updatePaymentMethod(businessId, userId, id, dto);
  }

  @Post('expense-categories')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('settings.edit')
  @ApiOperation({ summary: 'Create expense category' })
  @ApiResponse({ status: 201, type: ExpenseCategoryResponseDto })
  async createExpenseCategory(
    @Business() businessId: string,
    @UserId() userId: string,
    @Body() dto: CreateExpenseCategoryDto,
  ): Promise<ExpenseCategoryResponseDto> {
    return this.businessService.createExpenseCategory(businessId, userId, dto);
  }

  @Get('expense-categories')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('settings.view')
  @ApiOperation({ summary: 'Get all expense categories' })
  @ApiResponse({ status: 200, type: [ExpenseCategoryResponseDto] })
  async getExpenseCategories(
    @Business() businessId: string,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<ExpenseCategoryResponseDto[]> {
    return this.businessService.getExpenseCategories(businessId, includeInactive === 'true');
  }

  @Get('units')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('settings.view')
  @ApiOperation({ summary: 'Get all units' })
  @ApiResponse({ status: 200 })
  async getUnits(@Business() businessId: string) {
    return this.businessService.getUnits(businessId);
  }
}
