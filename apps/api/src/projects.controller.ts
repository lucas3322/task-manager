import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { AuthGuard, CurrentAuth, type AuthContext } from './auth.guard.js'
import { ProjectsService } from './projects.service.js'
@Controller('api/v1/projects') @UseGuards(AuthGuard)
export class ProjectsController {
  constructor(private readonly projects:ProjectsService){}
  @Get() list(@CurrentAuth() auth:AuthContext){return this.projects.list(auth.workspace.id)}
  @Post() create(@CurrentAuth() auth:AuthContext,@Body() input:{name:string;color?:string}){return this.projects.create(auth.workspace.id,input)}
}
