import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common'
import { AuthGuard, CurrentAuth, type AuthContext } from './auth.guard.js'
import { NotificationsService } from './notifications.service.js'

@Controller('api/v1/notifications') @UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notifications:NotificationsService){}
  @Get() list(@CurrentAuth() auth:AuthContext){return this.notifications.list(auth.user.id)}
  @Patch('read-all') readAll(@CurrentAuth() auth:AuthContext){return this.notifications.readAll(auth.user.id)}
  @Patch(':id/read') read(@CurrentAuth() auth:AuthContext,@Param('id') id:string){return this.notifications.read(auth.user.id,id)}
}
