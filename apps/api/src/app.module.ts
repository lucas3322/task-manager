import { Module } from '@nestjs/common'
import { DatabaseService } from './database.service.js'
import { TasksController } from './tasks.controller.js'
import { TasksService } from './tasks.service.js'
import { AuthController } from './auth.controller.js'
import { AuthGuard } from './auth.guard.js'
import { AuthService } from './auth.service.js'
import { ProjectsController } from './projects.controller.js'
import { ProjectsService } from './projects.service.js'

@Module({ controllers:[AuthController,ProjectsController,TasksController], providers:[DatabaseService,AuthService,AuthGuard,ProjectsService,TasksService] })
export class AppModule {}
