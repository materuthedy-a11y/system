import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateBusinessSettingsDto {
  @IsOptional() @IsString() defaultLocationId?: string | null;
  @IsOptional() @IsString() defaultPaymentMethodId?: string | null;
  @IsOptional() @IsString() @MaxLength(12) invoicePrefix?: string;
  @IsOptional() @IsString() @MaxLength(12) poPrefix?: string;
  @IsOptional() @IsString() @MaxLength(12) grnPrefix?: string;
  @IsOptional() @IsString() @MaxLength(12) receiptPrefix?: string;
  @IsOptional() @IsIn(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']) dateFormat?: string;
  @IsOptional() @IsIn(['12', '24']) timeFormat?: string;
  @IsOptional() @IsIn(['MONDAY', 'SUNDAY']) weekStartsOn?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100000) lowStockThreshold?: number;
  @IsOptional() @IsIn(['LIGHT', 'DARK', 'SYSTEM']) theme?: string;
}

export class TaxRateDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(24) code?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsIn(['SALES', 'PURCHASES', 'BOTH']) appliesTo?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Min(0) @Max(100) rate?: number;
}
