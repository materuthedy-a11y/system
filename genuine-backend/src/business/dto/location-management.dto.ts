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
  @IsEnum(['WAREHOUSE', 'SHOP', 'STORE', 'BRANCH', 'DEPOT'])
  type?: 'WAREHOUSE' | 'SHOP' | 'STORE' | 'BRANCH' | 'DEPOT';

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  managerId?: string | null;

}

export class UpdateLocationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsEnum(['WAREHOUSE', 'SHOP', 'STORE', 'BRANCH', 'DEPOT'])
  type?: 'WAREHOUSE' | 'SHOP' | 'STORE' | 'BRANCH' | 'DEPOT';

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  managerId?: string | null;
}

export class LocationResponseDto {
  id: string;
  businessId: string;
  name: string;
  code: string;
  type: string;
  address?: string | null;
  description?: string;
  managerId?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
