import { Module } from '@nestjs/common'
import { DatabaseService } from './database.service.js'
import { TasksController } from './tasks.controller.js'
import { TasksService } from './tasks.service.js'

@Module({ controllers:[TasksController], providers:[DatabaseService,TasksService] })
export class AppModule {}
