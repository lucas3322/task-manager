import { randomUUID } from 'node:crypto'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { AdvancedTaskFilter, GlobalSearchResult, SaveTaskFilterInput, SavedTaskFilter, WorkspaceRole } from '@orbitask/contracts'
import { DatabaseService } from './database.service.js'

interface SavedRow {id:string;user_id:string;project_id:string;name:string;filter:AdvancedTaskFilter;created_at:string;updated_at:string}
const mapSaved=(row:SavedRow):SavedTaskFilter=>({id:row.id,userId:row.user_id,projectId:row.project_id,name:row.name,filter:row.filter,createdAt:new Date(row.created_at).toISOString(),updatedAt:new Date(row.updated_at).toISOString()})

@Injectable()
export class SearchService {
  constructor(private readonly database:DatabaseService){}
  async global(workspaceId:string,userId:string,role:WorkspaceRole,raw:string):Promise<GlobalSearchResult>{
    const query=raw.trim().slice(0,160),recent=await this.database.query<{query:string}>('SELECT query FROM user_recent_searches WHERE user_id=$1 AND workspace_id=$2 ORDER BY created_at DESC LIMIT 8',[userId,workspaceId])
    if(query.length<2)return{tasks:[],projects:[],people:[],recent:recent.rows.map(item=>item.query)}
    const pattern=`%${query}%`,access="AND ($4<>'guest' OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=$2))"
    const [tasks,projects,people]=await Promise.all([
      this.database.query<{id:string;project_id:string;project_name:string;title:string;description:string;status_name:string;status_color:string;due_date:string|null}>(`SELECT t.id::text,t.project_id::text,p.name project_name,t.title,t.description,s.name status_name,s.color status_color,t.due_date::text FROM tasks t JOIN projects p ON p.id=t.project_id JOIN statuses s ON s.id=t.status_id WHERE p.workspace_id=$1 ${access} AND t.deleted_at IS NULL AND (t.title ILIKE $3 OR t.description ILIKE $3) ORDER BY t.updated_at DESC LIMIT 12`,[workspaceId,userId,pattern,role]),
      this.database.query<{id:string;name:string;description:string;color:string;icon:string}>(`SELECT p.id::text,p.name,p.description,p.color,p.icon FROM projects p WHERE p.workspace_id=$1 ${access} AND (p.name ILIKE $3 OR p.description ILIKE $3) ORDER BY p.name LIMIT 8`,[workspaceId,userId,pattern,role]),
      this.database.query<{id:string;name:string;email:string;avatar_url:string|null}>('SELECT u.id::text,u.name,u.email,u.avatar_url FROM users u JOIN workspace_members wm ON wm.user_id=u.id WHERE wm.workspace_id=$1 AND (u.name ILIKE $2 OR u.email ILIKE $2) ORDER BY u.name LIMIT 8',[workspaceId,pattern])
    ])
    await this.database.transaction(async tx=>{await tx('INSERT INTO user_recent_searches(id,user_id,workspace_id,query) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,workspace_id,query) DO UPDATE SET created_at=NOW()',[randomUUID(),userId,workspaceId,query]);await tx('DELETE FROM user_recent_searches WHERE id IN (SELECT id FROM user_recent_searches WHERE user_id=$1 AND workspace_id=$2 ORDER BY created_at DESC OFFSET 8)',[userId,workspaceId])})
    return{tasks:tasks.rows.map(item=>({id:item.id,projectId:item.project_id,projectName:item.project_name,title:item.title,description:item.description,statusName:item.status_name,statusColor:item.status_color,dueDate:item.due_date})),projects:projects.rows,people:people.rows.map(item=>({id:item.id,name:item.name,email:item.email,avatarUrl:item.avatar_url})),recent:[query,...recent.rows.map(item=>item.query).filter(item=>item!==query)].slice(0,8)}
  }
  private async projectAccess(workspaceId:string,userId:string,role:WorkspaceRole,projectId:string){const found=await this.database.query(`SELECT 1 FROM projects p WHERE p.id=$1 AND p.workspace_id=$2 AND ($4<>'guest' OR EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=$3))`,[projectId,workspaceId,userId,role]);if(!found.rowCount)throw new NotFoundException('Projeto não encontrado')}
  async listFilters(workspaceId:string,userId:string,role:WorkspaceRole,projectId:string){await this.projectAccess(workspaceId,userId,role,projectId);const result=await this.database.query<SavedRow>('SELECT * FROM user_saved_filters WHERE user_id=$1 AND project_id=$2 ORDER BY updated_at DESC',[userId,projectId]);return result.rows.map(mapSaved)}
  async saveFilter(workspaceId:string,userId:string,role:WorkspaceRole,input:SaveTaskFilterInput){if(!input.name?.trim())throw new BadRequestException('Informe um nome para o filtro');if(!input.filter)throw new BadRequestException('Configuração do filtro inválida');await this.projectAccess(workspaceId,userId,role,input.projectId);const result=await this.database.query<SavedRow>(`INSERT INTO user_saved_filters(id,user_id,project_id,name,filter) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(user_id,project_id,name) DO UPDATE SET filter=EXCLUDED.filter,updated_at=NOW() RETURNING *`,[input.id??randomUUID(),userId,input.projectId,input.name.trim(),JSON.stringify(input.filter)]);return mapSaved(result.rows[0])}
  async removeFilter(workspaceId:string,userId:string,id:string){const result=await this.database.query('DELETE FROM user_saved_filters f USING projects p WHERE f.id=$1 AND f.user_id=$2 AND f.project_id=p.id AND p.workspace_id=$3',[id,userId,workspaceId]);if(!result.rowCount)throw new NotFoundException('Filtro salvo não encontrado')}
}
