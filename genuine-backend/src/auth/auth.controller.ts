import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Get,
  Delete,
  Param,
  Patch,
  BadRequestException,
  UnauthorizedException,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AllowAnonymous } from '../common/decorators';
import { CurrentUser } from '../common/decorators/auth.decorator';
import { UserId } from '../common/decorators/auth.decorator';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  AuthResponseDto,
  PasswordResetRequestDto,
} from './dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private jwtService: JwtService,
  ) {}

  @Post('register')
  @AllowAnonymous()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register new business and admin user' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.register(
      dto,
      req.ip || 'unknown',
      req.get('user-agent') || undefined,
    );
    this.setRefreshCookie(req, response, result.refreshTokenCookie);
    const { refreshTokenCookie: _refreshTokenCookie, ...authResponse } = result;
    return authResponse;
  }

  @Post('login')
  @AllowAnonymous()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const ipAddress = req.ip || 'unknown';
    const result = await this.authService.login(dto, ipAddress, req.get('user-agent') || undefined);
    this.setRefreshCookie(req, response, result.refreshTokenCookie);
    const { refreshTokenCookie: _refreshTokenCookie, ...authResponse } = result;
    return authResponse;
  }

  @Post('refresh')
  @AllowAnonymous()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200 })
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Pick<AuthResponseDto, 'accessToken' | 'expiresIn' | 'idleTimeoutSeconds' | 'idleExpiresAt' | 'absoluteExpiresAt'>> {
    const refreshToken = this.readRefreshCookie(req);
    if (!refreshToken) throw new UnauthorizedException('Session expired. Sign in again.');
    const payload = this.jwtService.decode(refreshToken) as any;
    const userId = payload?.sub;
    if (!userId) {
      throw new BadRequestException('Invalid refresh token');
    }
    let result: Awaited<ReturnType<AuthService['refreshToken']>>;
    try {
      result = await this.authService.refreshToken(refreshToken, userId);
    } catch (error) {
      response.clearCookie(this.refreshCookieName(req), this.refreshCookieOptions(req));
      throw error;
    }
    this.setRefreshCookie(req, response, result.refreshTokenCookie);
    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      idleTimeoutSeconds: result.idleTimeoutSeconds,
      idleExpiresAt: result.idleExpiresAt,
      absoluteExpiresAt: result.absoluteExpiresAt,
    };
  }

  @Post('forgot-password')
  @AllowAnonymous()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset link' })
  @ApiResponse({ status: 200, type: PasswordResetRequestDto })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<PasswordResetRequestDto> {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @AllowAnonymous()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200 })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    const result = await this.authService.resetPassword(dto);
    response.clearCookie(this.refreshCookieName(req), this.refreshCookieOptions(req));
    return result;
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password (PATCH)' })
  @ApiResponse({ status: 200 })
  async changePasswordPatch(
    @UserId() userId: string,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    const result = await this.authService.changePassword(userId, dto);
    response.clearCookie(this.refreshCookieName(req), this.refreshCookieOptions(req));
    return result;
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password (POST)' })
  @ApiResponse({ status: 200 })
  async changePassword(
    @UserId() userId: string,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    const result = await this.authService.changePassword(userId, dto);
    response.clearCookie(this.refreshCookieName(req), this.refreshCookieOptions(req));
    return result;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200 })
  async logout(
    @CurrentUser() user: any,
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    response.clearCookie(this.refreshCookieName(req), this.refreshCookieOptions(req));
    return this.authService.logout(user.id, user.sessionId);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async listSessions(@CurrentUser() user: any) {
    return this.authService.listActiveSessions(user.id, user.sessionId);
  }

  @Delete('sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async revokeSession(@CurrentUser() user: any, @Param('sessionId') sessionId: string) {
    return this.authService.revokeSession(user.id, sessionId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current user info' })
  @ApiResponse({ status: 200 })
  async getCurrentUser(@CurrentUser() user: any) {
    const profile = await this.authService.getProfile(user.id);
    return {
      id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      firstName: user.firstName,
      lastName: user.lastName,
      businessId: user.businessId,
      businessName: user.business?.name || '',
      avatar: profile.avatar ? `/api/v1/auth/profile/avatar?v=${Date.now()}` : null,
      roles: user.userRoles?.map((ur: any) => ur.role?.name || ur.role) || [],
      permissions:
        user.userRoles?.flatMap((ur: any) => ur.role?.permissions || []).map((p: any) => p.key) ||
        [],
    };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200 })
  async getProfile(@CurrentUser() user: any) {
    return this.getCurrentUser(user);
  }

  @Patch('profile/avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update the current user profile photo' })
  async updateAvatar(@CurrentUser() user: any, @Body() dto: UpdateAvatarDto) {
    return this.authService.updateAvatar(user.id, user.businessId, dto.avatar);
  }

  @Get('profile/avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current user profile photo' })
  async getAvatar(@UserId() userId: string, @Res() response: Response) {
    const avatar = await this.authService.getAvatar(userId);
    response.setHeader('Content-Type', avatar.mimeType);
    response.setHeader('Cache-Control', 'private, max-age=300');
    response.send(avatar.bytes);
  }

  private refreshCookieName(req: Request): string {
    void req;
    return process.env.NODE_ENV === 'production' ? '__Host-mizania-refresh' : 'mizania-refresh';
  }

  private refreshCookieOptions(req: Request) {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || req.secure,
      sameSite: 'lax' as const,
      path: '/',
    };
  }

  private setRefreshCookie(req: Request, response: Response, token: string) {
    response.cookie(this.refreshCookieName(req), token, {
      ...this.refreshCookieOptions(req),
    });
  }

  private readRefreshCookie(req: Request): string | null {
    const cookies = req.headers.cookie || '';
    const names = ['__Host-mizania-refresh', 'mizania-refresh'];
    for (const name of names) {
      const entry = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
      // JWT base64url values need no decoding; returning the raw cookie value also
      // avoids malformed percent-encoding turning an expired cookie into a 500.
      if (entry) return entry.slice(name.length + 1);
    }
    return null;
  }
}
