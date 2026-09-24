import { randomUUID } from 'node:crypto'
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { CustomFieldDefinition, CustomFieldOption, CustomFieldType, Project, ProjectOption, ProjectSettings, UpdateProjectInput, UpdateProjectSettingsInput, WorkspaceRole } from '@orbitask/contracts'
import { DatabaseService } from './database.service.js'

interface ProjectRow {id:string;workspace_id:string;name:string;description:string;color:string;icon:string;created_at:string}
export const mapProject=(row:ProjectRow):Project=>({id:row.id,workspaceId:row.workspace_id,name:row.name,description:row.description,color:row.color,icon:row.icon||'folder',createdAt:new Date(row.created_at).toISOString()})
@Injectable()
export class ProjectsService {
  constructor(private readonly database:DatabaseService){}
  async list(workspaceId:string,userId?:string,role:WorkspaceRole='admin'){const result=await this.database.query<ProjectRow>(`SELECT p.* FROM projects p WHERE p.workspace_id=$1 AND ($3<>'guest' OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=$2)) ORDER BY p.created_at`,[workspaceId,userId??null,role]);return result.rows.map(mapProject)}
  async create(workspaceId:string,input:{name:string;color?:string},role:WorkspaceRole='admin'){
    if(role==='guest')throw new ForbiddenException('Convidados não podem criar projetos')
    const name=input.name?.trim();if(!name)throw new BadRequestException('Informe o nome do projeto')
    const projectId=randomUUID(),ids=[randomUUID(),randomUUID(),randomUUID(),randomUUID()]
    return this.database.transaction(async query=>{
      const result=await query<ProjectRow>('INSERT INTO projects (id,workspace_id,name,color) VALUES ($1,$2,$3,$4) RETURNING *',[projectId,workspaceId,name,input.color??'#665cf6'])
      await query(`INSERT INTO statuses (id,project_id,name,color,position) VALUES ($1,$5,'A fazer','#a0a5b1',0),($2,$5,'Em andamento','#665cf6',1),($3,$5,'Em revisão','#ee9b3b',2),($4,$5,'Concluído','#2ca87f',3)`,[...ids,projectId])
      return mapProject(result.rows[0])
    })
  }
  async update(workspaceId:string,input:UpdateProjectInput,role:WorkspaceRole='admin'){
    if(role==='guest')throw new ForbiddenException('Convidados não podem editar projetos')
    const name=input.name?.trim()
    if(input.name!==undefined&&!name)throw new BadRequestException('Informe o nome do projeto')
    if(input.color!==undefined&&!/^#[0-9a-f]{6}$/i.test(input.color))throw new BadRequestException('Informe uma cor hexadecimal válida')
    if(input.icon!==undefined&&!/^[a-z0-9-]{2,40}$/i.test(input.icon))throw new BadRequestException('Ícone de projeto inválido')
    const result=await this.database.query<ProjectRow>(`UPDATE projects SET
      name=COALESCE($3,name),description=COALESCE($4,description),color=COALESCE($5,color),icon=COALESCE($6,icon)
      WHERE id=$1 AND workspace_id=$2 RETURNING *`,[input.id,workspaceId,name??null,input.description?.trim()??null,input.color??null,input.icon??null])
    if(!result.rowCount)throw new NotFoundException('Projeto não encontrado')
    return mapProject(result.rows[0])
  }

  async ensureSettings(projectId:string):Promise<ProjectSettings>{
    const existing=await this.database.query('SELECT 1 FROM project_priorities WHERE project_id=$1 LIMIT 1',[projectId])
    if(!existing.rowCount)await this.database.query(`INSERT INTO project_priorities (id,project_id,name,color,position) VALUES
      ('low',$1,'Baixa','#2ca87f',0),('medium',$1,'Média','#6f7585',1),('high',$1,'Alta','#ee8b3b',2),('urgent',$1,'Urgente','#e45f65',3) ON CONFLICT (project_id,id) DO NOTHING`,[projectId])
    const [priorities,tags,badges]=await Promise.all([
      this.database.query<ProjectOption>('SELECT id,name,color,position FROM project_priorities WHERE project_id=$1 ORDER BY position',[projectId]),
      this.database.query<ProjectOption>('SELECT id::text,name,color,position FROM project_tags WHERE project_id=$1 ORDER BY position',[projectId]),
      this.database.query<ProjectOption>('SELECT id::text,name,color,position FROM project_badges WHERE project_id=$1 ORDER BY position',[projectId]),
    ])
    return {priorities:priorities.rows,tags:tags.rows,badges:badges.rows}
  }

  async getPreferences(userId:string,projectId:string){const result=await this.database.query<{card_density:'compact'|'detailed';default_view:'board'|'list'}>(`INSERT INTO user_project_preferences (user_id,project_id) VALUES ($1,$2) ON CONFLICT (user_id,project_id) DO UPDATE SET user_id=EXCLUDED.user_id RETURNING card_density,default_view`,[userId,projectId]);return{cardDensity:result.rows[0].card_density,defaultView:result.rows[0].default_view}}

  async updatePreferences(workspaceId:string,userId:string,projectId:string,input:{cardDensity?:'compact'|'detailed';defaultView?:'board'|'list'},role:WorkspaceRole='admin'){const allowed=await this.database.query(`SELECT 1 FROM projects p WHERE p.id=$1 AND p.workspace_id=$2 AND ($4<>'guest' OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=$3))`,[projectId,workspaceId,userId,role]);if(!allowed.rowCount)throw new NotFoundException('Projeto não encontrado');if(input.cardDensity&&!['compact','detailed'].includes(input.cardDensity))throw new BadRequestException('Densidade inválida');if(input.defaultView&&!['board','list'].includes(input.defaultView))throw new BadRequestException('Visualização inválida');await this.getPreferences(userId,projectId);const result=await this.database.query<{card_density:'compact'|'detailed';default_view:'board'|'list'}>(`UPDATE user_project_preferences SET card_density=COALESCE($3,card_density),default_view=COALESCE($4,default_view),updated_at=NOW() WHERE user_id=$1 AND project_id=$2 RETURNING card_density,default_view`,[userId,projectId,input.cardDensity??null,input.defaultView??null]);return{cardDensity:result.rows[0].card_density,defaultView:result.rows[0].default_view}}

  async updateSettings(workspaceId:string,input:UpdateProjectSettingsInput,role:WorkspaceRole='admin'){
    if(role==='guest')throw new ForbiddenException('Convidados não podem alterar configurações do projeto')
    const allowed=await this.database.query('SELECT 1 FROM projects WHERE id=$1 AND workspace_id=$2',[input.projectId,workspaceId])
    if(!allowed.rowCount)throw new NotFoundException('Projeto não encontrado')
    if(!input.statuses?.length)throw new BadRequestException('O projeto precisa ter ao menos uma coluna')
    if(!input.priorities?.length)throw new BadRequestException('O projeto precisa ter ao menos uma prioridade')
    const groups=[input.statuses,input.priorities,input.tags??[],input.badges??[]]
    for(const group of groups)for(const item of group){if(!item.id||!item.name?.trim())throw new BadRequestException('Todos os itens precisam de nome');if(!/^#[0-9a-f]{6}$/i.test(item.color))throw new BadRequestException('Cor inválida nas configurações')}
    const statusIds=input.statuses.map(item=>item.id),priorityIds=input.priorities.map(item=>item.id)
    const usedStatus=await this.database.query<{name:string}>(`SELECT DISTINCT s.name FROM tasks t JOIN statuses s ON s.id=t.status_id WHERE t.project_id=$1 AND NOT (t.status_id=ANY($2::varchar[])) LIMIT 1`,[input.projectId,statusIds])
    if(usedStatus.rowCount)throw new BadRequestException(`A coluna "${usedStatus.rows[0].name}" possui tarefas e não pode ser excluída`)
    const usedPriority=await this.database.query<{priority:string}>(`SELECT DISTINCT priority FROM tasks WHERE project_id=$1 AND NOT (priority=ANY($2::varchar[])) LIMIT 1`,[input.projectId,priorityIds])
    if(usedPriority.rowCount)throw new BadRequestException(`A prioridade "${usedPriority.rows[0].priority}" está em uso e não pode ser excluída`)
    await this.database.transaction(async query=>{
      for(const [position,item] of input.statuses.entries())await query(`INSERT INTO statuses (id,project_id,name,color,position) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,color=EXCLUDED.color,position=EXCLUDED.position WHERE statuses.project_id=EXCLUDED.project_id`,[item.id,input.projectId,item.name.trim(),item.color,position])
      for(const [position,item] of input.priorities.entries())await query(`INSERT INTO project_priorities (id,project_id,name,color,position) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (project_id,id) DO UPDATE SET name=EXCLUDED.name,color=EXCLUDED.color,position=EXCLUDED.position`,[item.id,input.projectId,item.name.trim(),item.color,position])
      for(const [position,item] of (input.tags??[]).entries())await query(`INSERT INTO project_tags (id,project_id,name,color,position) VALUES ($1::uuid,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,color=EXCLUDED.color,position=EXCLUDED.position WHERE project_tags.project_id=EXCLUDED.project_id`,[item.id,input.projectId,item.name.trim(),item.color,position])
      for(const [position,item] of (input.badges??[]).entries())await query(`INSERT INTO project_badges (id,project_id,name,color,position) VALUES ($1::uuid,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,color=EXCLUDED.color,position=EXCLUDED.position WHERE project_badges.project_id=EXCLUDED.project_id`,[item.id,input.projectId,item.name.trim(),item.color,position])
      await query('DELETE FROM statuses WHERE project_id=$1 AND NOT (id=ANY($2::varchar[]))',[input.projectId,statusIds])
      await query('DELETE FROM project_priorities WHERE project_id=$1 AND NOT (id=ANY($2::varchar[]))',[input.projectId,priorityIds])
      await query('DELETE FROM project_tags WHERE project_id=$1 AND NOT (id::text=ANY($2::varchar[]))',[input.projectId,(input.tags??[]).map(item=>item.id)])
      await query('DELETE FROM project_badges WHERE project_id=$1 AND NOT (id::text=ANY($2::varchar[]))',[input.projectId,(input.badges??[]).map(item=>item.id)])
    })
    return this.ensureSettings(input.projectId)
  }

  async updateCustomFields(workspaceId:string,projectId:string,fields:CustomFieldDefinition[],role:WorkspaceRole='admin'){
    if(role==='guest')throw new ForbiddenException('Convidados não podem alterar campos personalizados')
    const allowed=await this.database.query('SELECT 1 FROM projects WHERE id=$1 AND workspace_id=$2',[projectId,workspaceId]);if(!allowed.rowCount)throw new NotFoundException('Projeto não encontrado')
    const types:CustomFieldType[]=['text','number','date','single','multi']
    for(const field of fields??[]){if(!field.id||!field.name?.trim()||!types.includes(field.type))throw new BadRequestException('Campo personalizado inválido');if(['single','multi'].includes(field.type)&&!(field.options?.length))throw new BadRequestException(`O campo "${field.name}" precisa de opções`);for(const option of field.options??[]){if(!option.id||!option.label?.trim()||!/^#[0-9a-f]{6}$/i.test(option.color))throw new BadRequestException('Opção de campo inválida')}}
    await this.database.transaction(async query=>{for(const [position,field] of (fields??[]).entries())await query(`INSERT INTO project_custom_fields(id,project_id,name,type,options,position) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,type=EXCLUDED.type,options=EXCLUDED.options,position=EXCLUDED.position WHERE project_custom_fields.project_id=EXCLUDED.project_id`,[field.id,projectId,field.name.trim(),field.type,JSON.stringify(field.options??[]),position]);await query('DELETE FROM project_custom_fields WHERE project_id=$1 AND NOT(id::text=ANY($2::varchar[]))',[projectId,(fields??[]).map(field=>field.id)])})
    const result=await this.database.query<{id:string;project_id:string;name:string;type:CustomFieldType;options:CustomFieldOption[];position:number}>('SELECT id::text,project_id::text,name,type,options,position FROM project_custom_fields WHERE project_id=$1 ORDER BY position',[projectId])
    return result.rows.map(row=>({id:row.id,projectId:row.project_id,name:row.name,type:row.type,options:row.options,position:row.position}))
  }
}
