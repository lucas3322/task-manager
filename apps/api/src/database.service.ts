import { BadRequestException, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import pg, { Pool, type QueryResultRow } from 'pg'
import { migration } from './migration.js'

/* DATE chega como texto (AAAA-MM-DD): evita deslocar o dia conforme o fuso do servidor. */
pg.types.setTypeParser(1082, (value: string) => value)

const constraintMessages: Record<string, string> = {
  tasks_dates_check: 'A data de início não pode ser posterior ao prazo',
  task_attachments_url_check: 'Use um link começando com http:// ou https://',
}

/** Violações de integridade viram 400 com mensagem clara, em vez de erro 500. */
function translate(error: unknown): never {
  const failure = error as { code?: string; constraint?: string; message?: string }
  if (failure?.code === '23514') throw new BadRequestException(constraintMessages[failure.constraint ?? ''] ?? failure.message ?? 'Dados inválidos')
  if (failure?.code === '23503') throw new BadRequestException('Referência inválida: um dos itens informados não existe')
  if (failure?.code === '22P02' || failure?.code === '22007' || failure?.code === '22008') throw new BadRequestException('Formato de dado inválido')
  throw error
}

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
  }

  async onModuleDestroy(): Promise<void> { await this.pool.end() }

  query<T extends QueryResultRow>(text: string, values: unknown[] = []) { return this.pool.query<T>(text, values).catch(translate) }

  async transaction<T>(work: (query: DatabaseService['query']) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await work((text, values = []) => client.query(text, values).catch(translate))
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally { client.release() }
  }
}
