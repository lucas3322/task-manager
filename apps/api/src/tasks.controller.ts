import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import type { CreateTaskInput, UpdateTaskInput } from '@orbitask/contracts'
import { TasksService } from './tasks.service.js'
import { AuthGuard, CurrentAuth, type AuthContext } from './auth.guard.js'

@Controller('api/v1') @UseGuards(AuthGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}
  @Get('workspace/snapshot') snapshot(@CurrentAuth() auth:AuthContext,@Query('projectId') projectId?:string) { return this.tasks.snapshot(auth.user.id,auth.workspace,projectId) }
  @Post('tasks') create(@CurrentAuth() auth:AuthContext,@Body() input: CreateTaskInput) { return this.tasks.create(auth.workspace.id,input,auth.user.id,auth.workspace.role) }
  @Patch('tasks/:id') update(@CurrentAuth() auth:AuthContext,@Param('id') id: string, @Body() input: Omit<UpdateTaskInput,'id'>) { return this.tasks.update(auth.workspace.id,{ ...input, id },auth.user.id,auth.workspace.role) }
  @Delete('tasks/:id') trash(@CurrentAuth() auth:AuthContext,@Param('id') id: string) { return this.tasks.trash(auth.workspace.id,auth.user.id,auth.workspace.role,id) }
  @Post('tasks/:id/comments') comment(@CurrentAuth() auth:AuthContext,@Param('id') id:string,@Body() input:{body:string}) { return this.tasks.createComment(auth.workspace.id,auth.user.id,auth.workspace.role,id,input.body) }
  @Post('tasks/:id/attachments') attachment(@CurrentAuth() auth:AuthContext,@Param('id') id:string,@Body() input:{name:string;url:string}) { return this.tasks.addAttachment(auth.workspace.id,auth.user.id,auth.workspace.role,id,input) }
  @Delete('attachments/:id') removeAttachment(@CurrentAuth() auth:AuthContext,@Param('id') id:string) { return this.tasks.removeAttachment(auth.workspace.id,auth.user.id,auth.workspace.role,id) }
  @Post('tasks/:id/checklist') checklist(@CurrentAuth() auth:AuthContext,@Param('id') id:string,@Body() input:{title:string}) { return this.tasks.createChecklistItem(auth.workspace.id,auth.user.id,auth.workspace.role,id,input.title) }
  @Patch('checklist/:id') updateChecklist(@CurrentAuth() auth:AuthContext,@Param('id') id:string,@Body() input:{title?:string;completed?:boolean}) { return this.tasks.updateChecklistItem(auth.workspace.id,auth.user.id,auth.workspace.role,id,input) }
  @Delete('checklist/:id') removeChecklist(@CurrentAuth() auth:AuthContext,@Param('id') id:string) { return this.tasks.removeChecklistItem(auth.workspace.id,auth.user.id,auth.workspace.role,id) }
  @Post('tasks/:id/dependencies') dependency(@CurrentAuth() auth:AuthContext,@Param('id') id:string,@Body() input:{dependsOnTaskId:string}) { return this.tasks.addDependency(auth.workspace.id,auth.user.id,auth.workspace.role,id,input.dependsOnTaskId) }
  @Delete('tasks/:id/dependencies/:dependsOnTaskId') removeDependency(@CurrentAuth() auth:AuthContext,@Param('id') id:string,@Param('dependsOnTaskId') dependsOnTaskId:string) { return this.tasks.removeDependency(auth.workspace.id,auth.user.id,auth.workspace.role,id,dependsOnTaskId) }
  @Patch('tasks/:id/custom-fields/:fieldId') setCustomField(@CurrentAuth() auth:AuthContext,@Param('id') id:string,@Param('fieldId') fieldId:string,@Body() input:{value:string|number|string[]|null}) { return this.tasks.setCustomField(auth.workspace.id,auth.user.id,auth.workspace.role,id,fieldId,input.value) }
}
