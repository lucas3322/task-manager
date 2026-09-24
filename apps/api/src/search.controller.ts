import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import type { SaveTaskFilterInput } from '@orbitask/contracts'
import { AuthGuard, CurrentAuth, type AuthContext } from './auth.guard.js'
import { SearchService } from './search.service.js'

@Controller('api/v1') @UseGuards(AuthGuard)
export class SearchController {
  constructor(private readonly search:SearchService){}
  @Get('search') global(@CurrentAuth() auth:AuthContext,@Query('q') query=''){return this.search.global(auth.workspace.id,auth.user.id,auth.workspace.role,query)}
  @Get('saved-filters') list(@CurrentAuth() auth:AuthContext,@Query('projectId') projectId:string){return this.search.listFilters(auth.workspace.id,auth.user.id,auth.workspace.role,projectId)}
  @Post('saved-filters') save(@CurrentAuth() auth:AuthContext,@Body() input:SaveTaskFilterInput){return this.search.saveFilter(auth.workspace.id,auth.user.id,auth.workspace.role,input)}
  @Delete('saved-filters/:id') remove(@CurrentAuth() auth:AuthContext,@Param('id') id:string){return this.search.removeFilter(auth.workspace.id,auth.user.id,id)}
}
