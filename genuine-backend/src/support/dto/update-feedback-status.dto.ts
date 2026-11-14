import { IsIn } from 'class-validator';

export class UpdateFeedbackStatusDto {
  @IsIn(['OPEN', 'IN_PROGRESS', 'WAITING_ON_USER', 'RESOLVED', 'CLOSED'])
  status: string;
}
