import { Transform } from 'class-transformer';
import { ArrayUnique, IsArray, IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateManagedUserDto {
  @IsEmail() @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value) email: string;
  @IsString() @MinLength(2) @MaxLength(80) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) firstName: string;
  @IsString() @MinLength(2) @MaxLength(80) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) lastName: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsString() @MinLength(8) @MaxLength(128) @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/) password: string;
  @IsString() roleId: string;
}

export class UpdateManagedUserDto {
  @IsOptional() @IsEmail() @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value) email?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) firstName?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) lastName?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() roleId?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ResetManagedUserPasswordDto {
  @IsString() @MinLength(8) @MaxLength(128) @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/) newPassword: string;
}

export class CreateRoleDto {
  @IsString() @MinLength(2) @MaxLength(80) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) name: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsArray() @ArrayUnique() @IsString({ each: true }) permissions: string[];
}

export class UpdateRoleDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) permissions?: string[];
}
