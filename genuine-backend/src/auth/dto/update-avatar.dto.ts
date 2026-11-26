import { IsString, MaxLength, Matches } from 'class-validator';

export class UpdateAvatarDto {
  @IsString()
  @MaxLength(7_000_000)
  @Matches(/^$|^data:image\/(?:webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/)
  avatar: string;
}
