import { Injectable, NotFoundException } from '@nestjs/common'
import type { Notification } from '@orbitask/contracts'
import { DatabaseService } from './database.service.js'

@Injectable()
export class NotificationsService {
  constructor(private readonly database:DatabaseService){}
  async list(userId:string):Promise<Notification[]>{const result=await this.database.query<{id:string;task_id:string|null;project_id:string|null;type:string;title:string;message:string;read_at:string|null;created_at:string}>('SELECT id,task_id,project_id,type,title,message,read_at,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',[userId]);return result.rows.map(row=>({id:row.id,taskId:row.task_id,projectId:row.project_id,type:row.type,title:row.title,message:row.message,readAt:row.read_at?new Date(row.read_at).toISOString():null,createdAt:new Date(row.created_at).toISOString()}))}
  async read(userId:string,id:string){const result=await this.database.query('UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE id=$1 AND user_id=$2',[id,userId]);if(!result.rowCount)throw new NotFoundException('Notificação não encontrada')}
  async readAll(userId:string){await this.database.query('UPDATE notifications SET read_at=NOW() WHERE user_id=$1 AND read_at IS NULL',[userId])}
}
