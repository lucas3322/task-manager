import { randomUUID } from 'node:crypto'
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Pool, type QueryResultRow } from 'pg'
import { migration } from './migration.js'

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool

  constructor() {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) throw new Error('DATABASE_URL é obrigatória')
    this.pool = new Pool({ connectionString, max: 10, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined })
  }

  async onModuleInit(): Promise<void> {
    await this.pool.query(migration)
    await this.seed()
  }

  async onModuleDestroy(): Promise<void> { await this.pool.end() }

  query<T extends QueryResultRow>(text: string, values: unknown[] = []) { return this.pool.query<T>(text, values) }

  async transaction<T>(work: (query: DatabaseService['query']) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await work((text, values = []) => client.query(text, values))
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally { client.release() }
  }

  private async seed(): Promise<void> {
    const existing = await this.pool.query('SELECT id FROM projects LIMIT 1')
    if (existing.rowCount) return
    const projectId = randomUUID()
    await this.transaction(async (query) => {
      await query('INSERT INTO projects (id, name, description, color) VALUES ($1,$2,$3,$4)', [projectId, 'Lançamento do produto', 'Planejamento da primeira versão do Orbitask', '#665cf6'])
      await query(`INSERT INTO statuses (id,project_id,name,color,position) VALUES
        ('backlog',$1,'A fazer','#a0a5b1',0),('progress',$1,'Em andamento','#665cf6',1),('review',$1,'Em revisão','#ee9b3b',2),('done',$1,'Concluído','#2ca87f',3)`, [projectId])
      await query(`INSERT INTO tasks (id,project_id,title,status_id,priority,position) VALUES
        ($1,$2,'Definir objetivos do trimestre','backlog','high',0),
        ($3,$2,'Validar protótipo com usuários','progress','urgent',0),
        ($4,$2,'Preparar identidade visual','review','medium',0)`, [randomUUID(), projectId, randomUUID(), randomUUID()])
    })
  }
}
