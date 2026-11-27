import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const INSIGHT_SEVERITIES = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export const INSIGHT_STATUSES = [
  'ACTIVE',
  'ACKNOWLEDGED',
  'DISMISSED',
  'RESOLVED',
  'EXPIRED',
] as const;
export const INSIGHT_CATEGORIES = [
  'SALES',
  'PROFITABILITY',
  'INVENTORY',
  'CUSTOMERS',
  'SUPPLIERS',
  'FINANCE',
  'OPERATIONS',
] as const;

export class InsightFilterDto {
  @IsOptional()
  @IsIn(INSIGHT_SEVERITIES)
  severity?: string;

  @IsOptional()
  @IsIn(INSIGHT_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsIn(INSIGHT_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  locationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class InsightActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ReorderSuggestionItemDto {
  @IsString()
  @Length(1, 64)
  productId: string;

  @IsString()
  @Length(1, 64)
  locationId: string;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 4 })
  @Min(0.0001)
  quantity: number;
}

export class CreateDraftPurchaseOrdersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderSuggestionItemDto)
  items: ReorderSuggestionItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ReorderSuggestionsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  locationId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
