import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import type { SaveAutomationInput } from '@orbitask/contracts'
import { AuthGuard, CurrentAuth, type AuthContext } from './auth.guard.js'
import { AutomationsService } from './automations.service.js'

@Controller('api/v1/automations') @UseGuards(AuthGuard)
export class AutomationsController {
  constructor(private readonly automations:AutomationsService){}
  @Get() list(@CurrentAuth() auth:AuthContext,@Query('projectId') projectId:string){return this.automations.list(auth.workspace.id,projectId,auth.user.id,auth.workspace.role)}
  @Post() save(@CurrentAuth() auth:AuthContext,@Body() input:SaveAutomationInput){return this.automations.save(auth.workspace.id,auth.user.id,auth.workspace.role,input)}
  @Delete(':id') remove(@CurrentAuth() auth:AuthContext,@Param('id') id:string){return this.automations.remove(auth.workspace.id,auth.user.id,auth.workspace.role,id)}
}
