import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CloseBusinessDto {
  @ApiProperty({ description: 'Current account password to confirm business closure' })
  @IsString()
  @MinLength(1)
  password!: string;
}

export class TransferOwnershipDto {
  @ApiProperty({ description: 'ID of the active user who will become the new Owner' })
  @IsString()
  @MinLength(1)
  newOwnerId!: string;
}
