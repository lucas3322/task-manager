import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import type { CreateTaskInput, UpdateTaskInput } from '@orbitask/contracts'
import { TasksService } from './tasks.service.js'

@Controller('api/v1')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}
  @Get('workspace/snapshot') snapshot() { return this.tasks.snapshot() }
  @Post('tasks') create(@Body() input: CreateTaskInput) { return this.tasks.create(input) }
  @Patch('tasks/:id') update(@Param('id') id: string, @Body() input: Omit<UpdateTaskInput,'id'>) { return this.tasks.update({ ...input, id }) }
  @Delete('tasks/:id') trash(@Param('id') id: string) { return this.tasks.trash(id) }
}
