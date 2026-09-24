import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common'
import type { SaveGoalInput, SavePortfolioInput } from '@orbitask/contracts'
import { AuthGuard, CurrentAuth, type AuthContext } from './auth.guard.js'
import { InsightsService } from './insights.service.js'

@Controller('api/v1') @UseGuards(AuthGuard)
export class InsightsController {
  constructor(private readonly insights:InsightsService){}
  @Get('reports/dashboard') dashboard(@CurrentAuth() auth:AuthContext){return this.insights.dashboard(auth.workspace.id,auth.user.id,auth.workspace.role)}
  @Get('portfolio-overview') overview(@CurrentAuth() auth:AuthContext){return this.insights.overview(auth.workspace.id,auth.user.id,auth.workspace.role)}
  @Post('portfolios') savePortfolio(@CurrentAuth() auth:AuthContext,@Body() input:SavePortfolioInput){return this.insights.savePortfolio(auth.workspace.id,auth.workspace.role,input)}
  @Delete('portfolios/:id') removePortfolio(@CurrentAuth() auth:AuthContext,@Param('id') id:string){return this.insights.removePortfolio(auth.workspace.id,auth.workspace.role,id)}
  @Post('goals') saveGoal(@CurrentAuth() auth:AuthContext,@Body() input:SaveGoalInput){return this.insights.saveGoal(auth.workspace.id,auth.workspace.role,input)}
  @Delete('goals/:id') removeGoal(@CurrentAuth() auth:AuthContext,@Param('id') id:string){return this.insights.removeGoal(auth.workspace.id,auth.workspace.role,id)}
}
