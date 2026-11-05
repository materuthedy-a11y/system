import { IsString, IsEnum, IsOptional, IsBoolean, MaxLength, MinLength } from 'class-validator';

export class CreateLocationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsEnum(['WAREHOUSE', 'SHOP', 'BRANCH', 'DEPOT'])
  type?: 'WAREHOUSE' | 'SHOP' | 'BRANCH' | 'DEPOT';

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  description?: string;

}

export class UpdateLocationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsEnum(['WAREHOUSE', 'SHOP', 'BRANCH', 'DEPOT'])
  type?: 'WAREHOUSE' | 'SHOP' | 'BRANCH' | 'DEPOT';

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class LocationResponseDto {
  id: string;
  businessId: string;
  name: string;
  code: string;
  type: string;
  address?: string | null;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
