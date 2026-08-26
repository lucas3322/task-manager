import { randomUUID } from 'node:crypto'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { CreateTaskInput, Task, UpdateTaskInput, WorkspaceSnapshot } from '@orbitask/contracts'
import { DatabaseService } from './database.service.js'
import { ProjectsService, mapProject } from './projects.service.js'

interface TaskRow { id:string; project_id:string; parent_id:string|null; title:string; description:string; status_id:string; priority:Task['priority']; due_date:string|null; position:number; deleted_at:string|null; created_at:string; updated_at:string }
const mapTask = (row: TaskRow): Task => ({ id:row.id, projectId:row.project_id, parentId:row.parent_id, title:row.title, description:row.description, statusId:row.status_id, priority:row.priority, dueDate:row.due_date ? new Date(row.due_date).toISOString().slice(0,10) : null, position:Number(row.position), deletedAt:row.deleted_at, createdAt:new Date(row.created_at).toISOString(), updatedAt:new Date(row.updated_at).toISOString() })

@Injectable()
export class TasksService {
  constructor(private readonly database: DatabaseService,private readonly projectsService:ProjectsService) {}

  async snapshot(userId:string,workspace:{id:string;name:string;role:'admin'|'member'|'guest'},projectId?:string): Promise<WorkspaceSnapshot> {
    const projectResult = await this.database.query<{id:string;workspace_id:string;name:string;description:string;color:string;created_at:string}>('SELECT * FROM projects WHERE workspace_id=$1 AND ($2::uuid IS NULL OR id=$2) ORDER BY created_at LIMIT 1',[workspace.id,projectId??null])
    const project = projectResult.rows[0]
    if (!project) throw new NotFoundException('Workspace não inicializado')
    const [statusResult, taskResult] = await Promise.all([
      this.database.query<{id:string;name:string;color:string;position:number}>('SELECT id,name,color,position FROM statuses WHERE project_id=$1 ORDER BY position',[project.id]),
      this.database.query<TaskRow>('SELECT * FROM tasks WHERE project_id=$1 AND deleted_at IS NULL ORDER BY position', [project.id]),
    ])
    const [projects,userResult]=await Promise.all([this.projectsService.list(workspace.id),this.database.query<{id:string;name:string;email:string;created_at:string}>('SELECT id,name,email,created_at FROM users WHERE id=$1',[userId])])
    const user=userResult.rows[0]
    return {workspace, user:{id:user.id,name:user.name,email:user.email,createdAt:new Date(user.created_at).toISOString()},project:mapProject(project),projects,statuses: statusResult.rows, tasks: taskResult.rows.map(mapTask) }
  }

  async create(workspaceId:string,input: CreateTaskInput): Promise<Task> {
    if (!input.title?.trim()) throw new BadRequestException('O título da tarefa é obrigatório')
    const allowed=await this.database.query('SELECT 1 FROM projects WHERE id=$1 AND workspace_id=$2',[input.projectId,workspaceId]);if(!allowed.rowCount)throw new NotFoundException('Projeto não encontrado')
    const id = randomUUID()
    return this.database.transaction(async (query) => {
      const result = await query<TaskRow>(`INSERT INTO tasks (id,project_id,parent_id,title,status_id,priority,position) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [id,input.projectId,input.parentId??null,input.title.trim(),input.statusId,input.priority??'medium',Date.now()])
      await query('INSERT INTO activity_log (id,entity_type,entity_id,action,payload) VALUES ($1,$2,$3,$4,$5)', [randomUUID(),'task',id,'created',JSON.stringify(input)])
      return mapTask(result.rows[0])
    })
  }

  async update(workspaceId:string,input: UpdateTaskInput): Promise<Task> {
    const fields: string[] = []; const values: unknown[] = []
    const mapping: Array<[keyof UpdateTaskInput,string]> = [['title','title'],['description','description'],['statusId','status_id'],['priority','priority'],['dueDate','due_date'],['position','position']]
    for (const [key,column] of mapping) if (input[key] !== undefined) { values.push(input[key]); fields.push(`${column}=$${values.length}`) }
    if (!fields.length) throw new BadRequestException('Nenhuma alteração enviada')
    values.push(input.id)
    return this.database.transaction(async (query) => {
      values.push(workspaceId)
      const result = await query<TaskRow>(`UPDATE tasks SET ${fields.join(',')},updated_at=NOW() WHERE id=$${values.length-1} AND deleted_at IS NULL AND project_id IN (SELECT id FROM projects WHERE workspace_id=$${values.length}) RETURNING *`, values)
      if (!result.rows[0]) throw new NotFoundException('Tarefa não encontrada')
      await query('INSERT INTO activity_log (id,entity_type,entity_id,action,payload) VALUES ($1,$2,$3,$4,$5)', [randomUUID(),'task',input.id,'updated',JSON.stringify(input)])
      return mapTask(result.rows[0])
    })
  }

  async trash(workspaceId:string,id: string): Promise<void> {
    const result = await this.database.query('UPDATE tasks SET deleted_at=NOW(),updated_at=NOW() WHERE id=$1 AND deleted_at IS NULL AND project_id IN (SELECT id FROM projects WHERE workspace_id=$2)', [id,workspaceId])
    if (!result.rowCount) throw new NotFoundException('Tarefa não encontrada')
  }
}
