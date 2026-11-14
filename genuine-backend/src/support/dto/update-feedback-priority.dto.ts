import { IsIn } from 'class-validator';

export class UpdateFeedbackPriorityDto {
  @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
  priority: string;
}
