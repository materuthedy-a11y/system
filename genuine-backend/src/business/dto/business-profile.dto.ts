import { IsString, IsNumber, IsBoolean, IsEnum, IsOptional, Matches, Min, Max, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateBusinessProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  phone2?: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  businessDescription?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  businessType?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @Matches(/^(?:https:\/\/[^\s]+|data:image\/webp;base64,[A-Za-z0-9+/]+={0,2})$/)
  @MaxLength(90_000)
  logoUrl?: string | null;

  @IsOptional()
  @IsString()
  financialYear?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxPercentage?: number;

  @IsOptional()
  @IsBoolean()
  allowNegativeStock?: boolean;

  @IsOptional()
  @IsBoolean()
  requireApprovalForDiscounts?: boolean;

  @IsOptional()
  @IsBoolean()
  requireApprovalForReturns?: boolean;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @Matches(/^[A-Z]{3}$/, { message: 'Currency must be a three-letter ISO code' })
  currency?: string;

  @IsOptional()
  @IsEnum(['FIFO', 'WEIGHTED_AVERAGE'])
  costingMethod?: 'FIFO' | 'WEIGHTED_AVERAGE';
}

export class BusinessProfileResponseDto {
  id: string;
  name: string;
  businessType: string;
  description?: string;
  email?: string;
  phone?: string;
  phone2?: string;
  legalName?: string;
  registrationNumber?: string;
  address?: string;
  city?: string;
  region?: string;
  country: string;
  taxId?: string;
  timezone: string;
  language: string;
  website?: string;
  logoUrl?: string;
  financialYear: string;
  currency: string;
  taxPercentage: number;
  allowNegativeStock: boolean;
  requireApprovalForDiscounts: boolean;
  requireApprovalForReturns: boolean;
  costingMethod: string;
  isSetupComplete: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
