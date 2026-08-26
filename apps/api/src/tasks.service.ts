import { randomUUID } from 'node:crypto'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { CreateTaskInput, Task, UpdateTaskInput, WorkspaceSnapshot } from '@orbitask/contracts'
import { DatabaseService } from './database.service.js'

interface TaskRow { id:string; project_id:string; parent_id:string|null; title:string; description:string; status_id:string; priority:Task['priority']; due_date:string|null; position:number; deleted_at:string|null; created_at:string; updated_at:string }
const mapTask = (row: TaskRow): Task => ({ id:row.id, projectId:row.project_id, parentId:row.parent_id, title:row.title, description:row.description, statusId:row.status_id, priority:row.priority, dueDate:row.due_date, position:Number(row.position), deletedAt:row.deleted_at, createdAt:new Date(row.created_at).toISOString(), updatedAt:new Date(row.updated_at).toISOString() })

@Injectable()
export class TasksService {
  constructor(private readonly database: DatabaseService) {}

  async snapshot(): Promise<WorkspaceSnapshot> {
    const projectResult = await this.database.query<{id:string;name:string;description:string;color:string;created_at:string}>('SELECT * FROM projects ORDER BY created_at LIMIT 1')
    const project = projectResult.rows[0]
    if (!project) throw new NotFoundException('Workspace não inicializado')
    const [statusResult, taskResult] = await Promise.all([
      this.database.query<{id:string;name:string;color:string;position:number}>('SELECT * FROM statuses ORDER BY position'),
      this.database.query<TaskRow>('SELECT * FROM tasks WHERE project_id=$1 AND deleted_at IS NULL ORDER BY position', [project.id]),
    ])
    return { project: { id:project.id, name:project.name, description:project.description, color:project.color, createdAt:new Date(project.created_at).toISOString() }, statuses: statusResult.rows, tasks: taskResult.rows.map(mapTask) }
  }

  async create(input: CreateTaskInput): Promise<Task> {
    if (!input.title?.trim()) throw new BadRequestException('O título da tarefa é obrigatório')
    const id = randomUUID()
    return this.database.transaction(async (query) => {
      const result = await query<TaskRow>(`INSERT INTO tasks (id,project_id,parent_id,title,status_id,priority,position) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [id,input.projectId,input.parentId??null,input.title.trim(),input.statusId,input.priority??'medium',Date.now()])
      await query('INSERT INTO activity_log (id,entity_type,entity_id,action,payload) VALUES ($1,$2,$3,$4,$5)', [randomUUID(),'task',id,'created',JSON.stringify(input)])
      return mapTask(result.rows[0])
    })
  }

  async update(input: UpdateTaskInput): Promise<Task> {
    const fields: string[] = []; const values: unknown[] = []
    const mapping: Array<[keyof UpdateTaskInput,string]> = [['title','title'],['description','description'],['statusId','status_id'],['priority','priority'],['dueDate','due_date'],['position','position']]
    for (const [key,column] of mapping) if (input[key] !== undefined) { values.push(input[key]); fields.push(`${column}=$${values.length}`) }
    if (!fields.length) throw new BadRequestException('Nenhuma alteração enviada')
    values.push(input.id)
    return this.database.transaction(async (query) => {
      const result = await query<TaskRow>(`UPDATE tasks SET ${fields.join(',')},updated_at=NOW() WHERE id=$${values.length} AND deleted_at IS NULL RETURNING *`, values)
      if (!result.rows[0]) throw new NotFoundException('Tarefa não encontrada')
      await query('INSERT INTO activity_log (id,entity_type,entity_id,action,payload) VALUES ($1,$2,$3,$4,$5)', [randomUUID(),'task',input.id,'updated',JSON.stringify(input)])
      return mapTask(result.rows[0])
    })
  }

  async trash(id: string): Promise<void> {
    const result = await this.database.query('UPDATE tasks SET deleted_at=NOW(),updated_at=NOW() WHERE id=$1 AND deleted_at IS NULL', [id])
    if (!result.rowCount) throw new NotFoundException('Tarefa não encontrada')
  }
}
