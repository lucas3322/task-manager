import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import type { SignInInput, SignUpInput } from '@orbitask/contracts'
import { AuthService } from './auth.service.js'
import { AuthGuard, CurrentAuth, type AuthContext } from './auth.guard.js'

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly auth:AuthService) {}
  @Post('signup') signUp(@Body() input:SignUpInput){return this.auth.signUp(input)}
  @Post('login') signIn(@Body() input:SignInInput){return this.auth.signIn(input)}
  @Get('me') @UseGuards(AuthGuard) me(@CurrentAuth() auth:AuthContext){return {user:auth.user,workspace:auth.workspace}}
  @Post('logout') @UseGuards(AuthGuard) async logout(@CurrentAuth() auth:AuthContext){await this.auth.signOut(auth.token);return {ok:true}}
}
