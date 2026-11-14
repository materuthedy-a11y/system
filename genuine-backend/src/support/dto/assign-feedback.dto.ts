import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AssignFeedbackDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  userId?: string | null;
}
