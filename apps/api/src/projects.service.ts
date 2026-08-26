import { randomUUID } from 'node:crypto'
import { BadRequestException, Injectable } from '@nestjs/common'
import type { Project } from '@orbitask/contracts'
import { DatabaseService } from './database.service.js'

interface ProjectRow {id:string;workspace_id:string;name:string;description:string;color:string;created_at:string}
export const mapProject=(row:ProjectRow):Project=>({id:row.id,workspaceId:row.workspace_id,name:row.name,description:row.description,color:row.color,createdAt:new Date(row.created_at).toISOString()})
@Injectable()
export class ProjectsService {
  constructor(private readonly database:DatabaseService){}
  async list(workspaceId:string){const result=await this.database.query<ProjectRow>('SELECT * FROM projects WHERE workspace_id=$1 ORDER BY created_at',[workspaceId]);return result.rows.map(mapProject)}
  async create(workspaceId:string,input:{name:string;color?:string}){
    const name=input.name?.trim();if(!name)throw new BadRequestException('Informe o nome do projeto')
    const projectId=randomUUID(),ids=[randomUUID(),randomUUID(),randomUUID(),randomUUID()]
    return this.database.transaction(async query=>{
      const result=await query<ProjectRow>('INSERT INTO projects (id,workspace_id,name,color) VALUES ($1,$2,$3,$4) RETURNING *',[projectId,workspaceId,name,input.color??'#665cf6'])
      await query(`INSERT INTO statuses (id,project_id,name,color,position) VALUES ($1,$5,'A fazer','#a0a5b1',0),($2,$5,'Em andamento','#665cf6',1),($3,$5,'Em revisão','#ee9b3b',2),($4,$5,'Concluído','#2ca87f',3)`,[...ids,projectId])
      return mapProject(result.rows[0])
    })
  }
}
