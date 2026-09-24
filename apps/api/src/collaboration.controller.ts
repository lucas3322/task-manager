import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import type { WorkspaceRole } from '@orbitask/contracts'
import { AuthGuard, CurrentAuth, type AuthContext } from './auth.guard.js'
import { CollaborationService } from './collaboration.service.js'

@Controller('api/v1')
export class CollaborationController {
  constructor(private readonly collaboration:CollaborationService){}
  @Get('invites/:token') inspect(@Param('token') token:string){return this.collaboration.inspectInvite(token)}
  @Post('invites/:token/accept') accept(@Param('token') token:string,@Body() input:{name?:string;password:string}){return this.collaboration.acceptInvite(token,input)}
  @Get('workspace/members') @UseGuards(AuthGuard) list(@CurrentAuth() auth:AuthContext){return this.collaboration.list(auth.workspace.id,auth.workspace.role)}
  @Post('workspace/invites') @UseGuards(AuthGuard) invite(@CurrentAuth() auth:AuthContext,@Body() input:{email:string;role:WorkspaceRole;projectIds?:string[]}){return this.collaboration.invite(auth.workspace.id,auth.user.id,auth.workspace.role,input)}
  @Delete('workspace/invites/:id') @UseGuards(AuthGuard) revoke(@CurrentAuth() auth:AuthContext,@Param('id') id:string){return this.collaboration.revokeInvite(auth.workspace.id,auth.workspace.role,id)}
  @Patch('workspace/members/:userId') @UseGuards(AuthGuard) update(@CurrentAuth() auth:AuthContext,@Param('userId') userId:string,@Body() input:{role:WorkspaceRole;projectIds?:string[]}){return this.collaboration.updateMember(auth.workspace.id,auth.user.id,auth.workspace.role,userId,input)}
  @Delete('workspace/members/:userId') @UseGuards(AuthGuard) remove(@CurrentAuth() auth:AuthContext,@Param('userId') userId:string){return this.collaboration.removeMember(auth.workspace.id,auth.user.id,auth.workspace.role,userId)}
  @Patch('profile') @UseGuards(AuthGuard) profile(@CurrentAuth() auth:AuthContext,@Body() input:{name:string;avatarUrl?:string|null}){return this.collaboration.updateProfile(auth.user.id,input)}
}
