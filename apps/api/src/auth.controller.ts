import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import type { CreateApiTokenInput, SignInInput, SignUpInput } from '@orbitask/contracts'
import { AuthService } from './auth.service.js'
import { AuthGuard, CurrentAuth, type AuthContext } from './auth.guard.js'

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly auth:AuthService) {}
  @Post('signup') signUp(@Body() input:SignUpInput){return this.auth.signUp(input)}
  @Post('login') signIn(@Body() input:SignInInput){return this.auth.signIn(input)}
  @Get('me') @UseGuards(AuthGuard) me(@CurrentAuth() auth:AuthContext){return {user:auth.user,workspace:auth.workspace}}
  @Post('logout') @UseGuards(AuthGuard) async logout(@CurrentAuth() auth:AuthContext){await this.auth.signOut(auth.token);return {ok:true}}
  @Post('logout-others') @UseGuards(AuthGuard) logoutOthers(@CurrentAuth() auth:AuthContext){return this.auth.signOutOthers(auth.user.id,auth.token)}
  @Get('tokens') @UseGuards(AuthGuard) tokens(@CurrentAuth() auth:AuthContext){return this.auth.listApiTokens(auth.user.id,auth.workspace.id)}
  @Post('tokens') @UseGuards(AuthGuard) createToken(@CurrentAuth() auth:AuthContext,@Body() input:CreateApiTokenInput){return this.auth.createApiToken(auth.user.id,auth.workspace.id,auth.via,input)}
  @Delete('tokens/:id') @UseGuards(AuthGuard) revokeToken(@CurrentAuth() auth:AuthContext,@Param('id') id:string){return this.auth.revokeApiToken(auth.user.id,auth.workspace.id,id)}
  @Patch('password') @UseGuards(AuthGuard) password(@CurrentAuth() auth:AuthContext,@Body() input:{currentPassword:string;newPassword:string}){return this.auth.changePassword(auth.user.id,auth.token,input)}
}
