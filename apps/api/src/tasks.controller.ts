import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import type { CreateTaskInput, UpdateTaskInput } from '@orbitask/contracts'
import { TasksService } from './tasks.service.js'
import { AuthGuard, CurrentAuth, type AuthContext } from './auth.guard.js'

@Controller('api/v1') @UseGuards(AuthGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}
  @Get('workspace/snapshot') snapshot(@CurrentAuth() auth:AuthContext,@Query('projectId') projectId?:string) { return this.tasks.snapshot(auth.user.id,auth.workspace,projectId) }
  @Post('tasks') create(@CurrentAuth() auth:AuthContext,@Body() input: CreateTaskInput) { return this.tasks.create(auth.workspace.id,input) }
  @Patch('tasks/:id') update(@CurrentAuth() auth:AuthContext,@Param('id') id: string, @Body() input: Omit<UpdateTaskInput,'id'>) { return this.tasks.update(auth.workspace.id,{ ...input, id }) }
  @Delete('tasks/:id') trash(@CurrentAuth() auth:AuthContext,@Param('id') id: string) { return this.tasks.trash(auth.workspace.id,id) }
}
