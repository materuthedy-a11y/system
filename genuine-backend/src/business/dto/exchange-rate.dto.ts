import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class CreateExchangeRateDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'Currency code must be a three-letter ISO code' })
  currencyCode: string;

  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  @Max(1000000000)
  rateToBase: number;

  @IsDateString()
  effectiveFrom: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ConvertCurrencyDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'Currency code must be a three-letter ISO code' })
  currencyCode: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1000000000000)
  amount: number;

  @IsDateString()
  asOf: string;

  @IsIn(['TO_BASE', 'FROM_BASE'])
  direction: 'TO_BASE' | 'FROM_BASE';
}
