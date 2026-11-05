import { IsString, IsOptional, IsBoolean, IsEnum, MaxLength, MinLength } from 'class-validator';

export enum PaymentMethodType {
  CASH = 'CASH',
  BANK = 'BANK',
  MOBILE = 'MOBILE',
  CHEQUE = 'CHEQUE',
  CREDIT = 'CREDIT',
  CUSTOM = 'CUSTOM',
}

export class CreatePaymentMethodDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(PaymentMethodType)
  methodType?: PaymentMethodType;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  code?: string;

  @IsOptional()
  @IsBoolean()
  requiresReference?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bankDetails?: string;
}

export class UpdatePaymentMethodDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(PaymentMethodType)
  methodType?: PaymentMethodType;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  code?: string;

  @IsOptional()
  @IsBoolean()
  requiresReference?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bankDetails?: string;
}

export class PaymentMethodResponseDto {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  code?: string;
  methodType: string;
  requiresReference: boolean;
  bankDetails?: string;
  isActive: boolean;
  createdAt: Date;
}
