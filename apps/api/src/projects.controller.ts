import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import type { CustomFieldDefinition, UpdateProjectInput, UpdateProjectSettingsInput } from '@orbitask/contracts'
import { AuthGuard, CurrentAuth, type AuthContext } from './auth.guard.js'
import { ProjectsService } from './projects.service.js'
@Controller('api/v1/projects') @UseGuards(AuthGuard)
export class ProjectsController {
  constructor(private readonly projects:ProjectsService){}
  @Get() list(@CurrentAuth() auth:AuthContext){return this.projects.list(auth.workspace.id,auth.user.id,auth.workspace.role)}
  @Post() create(@CurrentAuth() auth:AuthContext,@Body() input:{name:string;color?:string}){return this.projects.create(auth.workspace.id,input,auth.workspace.role)}
  @Patch(':id') update(@CurrentAuth() auth:AuthContext,@Param('id') id:string,@Body() input:Omit<UpdateProjectInput,'id'>){return this.projects.update(auth.workspace.id,{...input,id},auth.workspace.role)}
  @Patch(':id/settings') updateSettings(@CurrentAuth() auth:AuthContext,@Param('id') id:string,@Body() input:Omit<UpdateProjectSettingsInput,'projectId'>){return this.projects.updateSettings(auth.workspace.id,{...input,projectId:id},auth.workspace.role)}
  @Patch(':id/preferences') updatePreferences(@CurrentAuth() auth:AuthContext,@Param('id') id:string,@Body() input:{cardDensity?:'compact'|'detailed';defaultView?:'board'|'list'}){return this.projects.updatePreferences(auth.workspace.id,auth.user.id,id,input,auth.workspace.role)}
  @Patch(':id/custom-fields') updateCustomFields(@CurrentAuth() auth:AuthContext,@Param('id') id:string,@Body() input:{fields:CustomFieldDefinition[]}){return this.projects.updateCustomFields(auth.workspace.id,id,input.fields,auth.workspace.role)}
}
