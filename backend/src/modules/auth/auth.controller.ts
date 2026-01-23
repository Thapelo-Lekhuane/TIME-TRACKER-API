import { Controller, Post, Body, HttpCode, HttpStatus, HttpException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from '../../common/dto/login.dto';
import { TokenResponseDto } from '../../common/dto/token-response.dto';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiOkResponse({ type: TokenResponseDto })
  @ApiBody({ type: LoginDto })
  async login(@Body() loginDto: LoginDto): Promise<TokenResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Sign up as a new user' })
  @ApiOkResponse({ 
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            fullName: { type: 'string' },
            role: { type: 'string' },
          },
        },
        accessToken: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@example.com' },
        password: { type: 'string', example: 'password123' },
        fullName: { type: 'string', example: 'John Doe' },
        designation: { type: 'string', example: 'Software Developer' },
        timeZone: { type: 'string', example: 'Africa/Johannesburg' },
      },
      required: ['email', 'password', 'fullName'],
    },
  })
  async signup(@Body() body: { email: string; password: string; fullName: string; designation?: string; timeZone?: string }) {
    // Check if user already exists
    const existing = await this.usersService.findByEmail(body.email);
    if (existing) {
      throw new HttpException('User with this email already exists', 409);
    }

    // Create user with EMPLOYEE role by default
    const user = await this.usersService.create({
      email: body.email,
      password: body.password,
      fullName: body.fullName,
      designation: body.designation,
      timeZone: body.timeZone || this.configService.get<string>('admin.timeZone') || 'Africa/Johannesburg',
    });

    // Generate token for auto-login
    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      accessToken,
      message: 'User created successfully',
    };
  }

  @Post('create-admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Create admin user manually (development only)',
    description: 'This endpoint allows creating an admin user if bootstrap failed. Use only in development. Returns the created admin user info and a login token.'
  })
  @ApiOkResponse({ 
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            fullName: { type: 'string' },
            role: { type: 'string' },
          },
        },
        accessToken: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  @ApiBody({ 
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'admin@example.com' },
        password: { type: 'string', example: 'admin123' },
        timeZone: { type: 'string', example: 'Africa/Johannesburg' },
      },
      required: ['email', 'password'],
    },
  })
  async createAdmin(@Body() body: { email: string; password: string; timeZone?: string }) {
    const admin = await this.usersService.createAdmin(
      body.email,
      body.password,
      body.timeZone || this.configService.get<string>('admin.timeZone') || 'Africa/Johannesburg',
    );
    
    // Generate token directly instead of using login (avoids password comparison issues)
    const payload = { sub: admin.id, role: admin.role };
    const accessToken = this.jwtService.sign(payload);
    
    return {
      user: {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
      },
      accessToken,
      message: 'Admin user created successfully',
    };
  }
}
