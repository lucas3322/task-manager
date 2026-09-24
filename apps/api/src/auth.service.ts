import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'
import bcrypt from 'bcryptjs'
import type { AuthSession, SignInInput, SignUpInput, User, Workspace } from '@orbitask/contracts'
import { DatabaseService } from './database.service.js'

interface UserRow { id:string; name:string; email:string; password_hash:string; avatar_url:string|null; created_at:string }
interface MembershipRow { id:string; name:string; role:Workspace['role'] }
const publicUser = (row: UserRow): User => ({ id:row.id, name:row.name, email:row.email, avatarUrl:row.avatar_url, createdAt:new Date(row.created_at).toISOString() })
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

@Injectable()
export class AuthService {
  constructor(private readonly database: DatabaseService) {}

  async signUp(input: SignUpInput): Promise<{ token:string; session:AuthSession }> {
    const name = input.name?.trim(); const email = input.email?.trim().toLowerCase()
    if (!name || name.length < 2) throw new BadRequestException('Informe seu nome')
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new BadRequestException('Informe um e-mail válido')
    if (!input.password || input.password.length < 8) throw new BadRequestException('A senha deve ter pelo menos 8 caracteres')
    const exists = await this.database.query('SELECT 1 FROM users WHERE email=$1', [email])
    if (exists.rowCount) throw new BadRequestException('Este e-mail já está cadastrado')
    const userId=randomUUID(), workspaceId=randomUUID(), projectId=randomUUID()
    const workspaceName=input.workspaceName?.trim() || `Workspace de ${name.split(' ')[0]}`
    const statusIds=[randomUUID(),randomUUID(),randomUUID(),randomUUID()]
    const passwordHash=await bcrypt.hash(input.password,12)
    await this.database.transaction(async query => {
      await query('INSERT INTO users (id,name,email,password_hash) VALUES ($1,$2,$3,$4)',[userId,name,email,passwordHash])
      await query('INSERT INTO workspaces (id,name) VALUES ($1,$2)',[workspaceId,workspaceName])
      await query("INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ($1,$2,'admin')",[workspaceId,userId])
      await query("INSERT INTO projects (id,workspace_id,name,description,color) VALUES ($1,$2,'Meu primeiro projeto','Comece organizando as tarefas da sua equipe','#665cf6')",[projectId,workspaceId])
      await query(`INSERT INTO statuses (id,project_id,name,color,position) VALUES ($1,$5,'A fazer','#a0a5b1',0),($2,$5,'Em andamento','#665cf6',1),($3,$5,'Em revisão','#ee9b3b',2),($4,$5,'Concluído','#2ca87f',3)`,[...statusIds,projectId])
    })
    return this.issueSession(userId,workspaceId)
  }

  async signIn(input: SignInInput): Promise<{ token:string; session:AuthSession }> {
    const result=await this.database.query<UserRow>('SELECT * FROM users WHERE email=$1',[input.email?.trim().toLowerCase()])
    const user=result.rows[0]
    if (!user || !await bcrypt.compare(input.password ?? '',user.password_hash)) throw new UnauthorizedException('E-mail ou senha inválidos')
    return this.issueSession(user.id)
  }

  async authenticate(token: string): Promise<{user:User;workspace:Workspace}> {
    const result=await this.database.query<UserRow & {workspace_id:string;workspace_name:string;role:Workspace['role']}>(`SELECT u.*,w.id workspace_id,w.name workspace_name,wm.role FROM auth_sessions s JOIN users u ON u.id=s.user_id JOIN workspace_members wm ON wm.user_id=u.id AND (s.workspace_id IS NULL OR wm.workspace_id=s.workspace_id) JOIN workspaces w ON w.id=wm.workspace_id WHERE s.token_hash=$1 AND s.expires_at>NOW() ORDER BY wm.created_at LIMIT 1`,[hashToken(token)])
    const row=result.rows[0]
    if (!row) throw new UnauthorizedException('Sessão inválida ou expirada')
    return {user:publicUser(row),workspace:{id:row.workspace_id,name:row.workspace_name,role:row.role}}
  }

  async signOut(token: string) { await this.database.query('DELETE FROM auth_sessions WHERE token_hash=$1',[hashToken(token)]) }

  async issueSession(userId:string,workspaceId?:string): Promise<{token:string;session:AuthSession}> {
    const token=randomBytes(32).toString('base64url')
    await this.database.query("INSERT INTO auth_sessions (id,user_id,token_hash,workspace_id,expires_at) VALUES ($1,$2,$3,$4,NOW()+INTERVAL '30 days')",[randomUUID(),userId,hashToken(token),workspaceId??null])
    const auth=await this.authenticate(token)
    return {token,session:auth}
  }
}
