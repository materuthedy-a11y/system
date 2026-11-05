export class AuthResponseDto {
  accessToken: string;
  expiresIn: number;
  idleTimeoutSeconds: number;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
    businessId: string;
    businessName: string;
    roles: string[];
    permissions: string[];
  };
}
