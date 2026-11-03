import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCustomerActivityDto {
  @IsEnum(['NOTE', 'CALL', 'EMAIL', 'VISIT'])
  type: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;
}
