import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import bcrypt from 'bcryptjs'
import type { ApiToken, AuthSession, CreateApiTokenInput, CreatedApiToken, SignInInput, SignUpInput, User, Workspace } from '@orbitask/contracts'
import { DatabaseService } from './database.service.js'

interface UserRow { id:string; name:string; email:string; password_hash:string; avatar_url:string|null; created_at:string }
interface MembershipRow { id:string; name:string; role:Workspace['role'] }
const publicUser = (row: UserRow): User => ({ id:row.id, name:row.name, email:row.email, avatarUrl:row.avatar_url, createdAt:new Date(row.created_at).toISOString() })
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
/** Prefixo dos tokens de acesso pessoal; facilita reconhecer (e revogar) um token vazado. */
export const API_TOKEN_PREFIX = 'otk_'
const MAX_API_TOKENS = 20
interface ApiTokenRow { id:string; name:string; prefix:string; created_at:string; last_used_at:string|null; expires_at:string|null }
const iso = (value:string|null) => value ? new Date(value).toISOString() : null
const mapApiToken = (row:ApiTokenRow): ApiToken => ({ id:row.id, name:row.name, prefix:row.prefix, createdAt:new Date(row.created_at).toISOString(), lastUsedAt:iso(row.last_used_at), expiresAt:iso(row.expires_at) })

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

  async authenticate(token: string): Promise<{user:User;workspace:Workspace;via:'session'|'token'}> {
    if (token.startsWith(API_TOKEN_PREFIX)) return this.authenticateApiToken(token)
    const result=await this.database.query<UserRow & {workspace_id:string;workspace_name:string;role:Workspace['role']}>(`SELECT u.*,w.id workspace_id,w.name workspace_name,wm.role FROM auth_sessions s JOIN users u ON u.id=s.user_id JOIN workspace_members wm ON wm.user_id=u.id AND (s.workspace_id IS NULL OR wm.workspace_id=s.workspace_id) JOIN workspaces w ON w.id=wm.workspace_id WHERE s.token_hash=$1 AND s.expires_at>NOW() ORDER BY wm.created_at LIMIT 1`,[hashToken(token)])
    const row=result.rows[0]
    if (!row) throw new UnauthorizedException('Sessão inválida ou expirada')
    return {user:publicUser(row),workspace:{id:row.workspace_id,name:row.workspace_name,role:row.role},via:'session'}
  }

  private async authenticateApiToken(token:string): Promise<{user:User;workspace:Workspace;via:'token'}> {
    const result=await this.database.query<UserRow & {token_id:string;workspace_id:string;workspace_name:string;role:Workspace['role'];last_used_at:string|null}>(`SELECT u.*,t.id token_id,t.last_used_at,w.id workspace_id,w.name workspace_name,wm.role FROM api_tokens t JOIN users u ON u.id=t.user_id JOIN workspace_members wm ON wm.user_id=u.id AND wm.workspace_id=t.workspace_id JOIN workspaces w ON w.id=t.workspace_id WHERE t.token_hash=$1 AND (t.expires_at IS NULL OR t.expires_at>NOW())`,[hashToken(token)])
    const row=result.rows[0]
    if (!row) throw new UnauthorizedException('Token de acesso inválido, revogado ou expirado')
    /* Registra o uso no máximo uma vez por minuto para não escrever no banco a cada chamada. */
    if (!row.last_used_at || Date.now()-new Date(row.last_used_at).getTime()>60_000) await this.database.query('UPDATE api_tokens SET last_used_at=NOW() WHERE id=$1',[row.token_id])
    return {user:publicUser(row),workspace:{id:row.workspace_id,name:row.workspace_name,role:row.role},via:'token'}
  }

  async listApiTokens(userId:string,workspaceId:string): Promise<ApiToken[]> {
    const result=await this.database.query<ApiTokenRow>('SELECT id,name,prefix,created_at,last_used_at,expires_at FROM api_tokens WHERE user_id=$1 AND workspace_id=$2 ORDER BY created_at DESC',[userId,workspaceId])
    return result.rows.map(mapApiToken)
  }

  async createApiToken(userId:string,workspaceId:string,via:'session'|'token',input:CreateApiTokenInput): Promise<CreatedApiToken> {
    if (via==='token') throw new ForbiddenException('Tokens de acesso não podem criar outros tokens. Entre no Orbitask para gerar um novo.')
    const name=input?.name?.trim()
    if (!name) throw new BadRequestException('Dê um nome ao token, por exemplo "Claude Code no notebook"')
    if (name.length>80) throw new BadRequestException('O nome do token pode ter até 80 caracteres')
    const days=input.expiresInDays??null
    if (days!==null && (!Number.isInteger(days) || days<1 || days>3650)) throw new BadRequestException('A validade deve ser entre 1 e 3650 dias')
    const count=await this.database.query<{count:string}>('SELECT COUNT(*)::text count FROM api_tokens WHERE user_id=$1 AND workspace_id=$2',[userId,workspaceId])
    if (Number(count.rows[0]?.count??0)>=MAX_API_TOKENS) throw new BadRequestException(`Limite de ${MAX_API_TOKENS} tokens atingido. Revogue algum que não use mais.`)
    const token=`${API_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`
    const result=await this.database.query<ApiTokenRow>(`INSERT INTO api_tokens (id,user_id,workspace_id,name,prefix,token_hash,expires_at) VALUES ($1,$2,$3,$4,$5,$6,CASE WHEN $7::int IS NULL THEN NULL ELSE NOW()+make_interval(days=>$7::int) END) RETURNING id,name,prefix,created_at,last_used_at,expires_at`,[randomUUID(),userId,workspaceId,name,token.slice(0,12),hashToken(token),days])
    return {...mapApiToken(result.rows[0]),token}
  }

  async revokeApiToken(userId:string,workspaceId:string,id:string){
    const result=await this.database.query('DELETE FROM api_tokens WHERE id::text=$1 AND user_id=$2 AND workspace_id=$3',[id,userId,workspaceId])
    if (!result.rowCount) throw new NotFoundException('Token não encontrado')
    return {ok:true}
  }

  async signOut(token: string) { await this.database.query('DELETE FROM auth_sessions WHERE token_hash=$1',[hashToken(token)]) }

  async signOutOthers(userId:string,token:string){const result=await this.database.query('DELETE FROM auth_sessions WHERE user_id=$1 AND token_hash<>$2',[userId,hashToken(token)]);return{revoked:result.rowCount??0}}

  async changePassword(userId:string,token:string,input:{currentPassword:string;newPassword:string}){
    if(!input.newPassword||input.newPassword.length<8)throw new BadRequestException('A nova senha deve ter pelo menos 8 caracteres')
    const result=await this.database.query<UserRow>('SELECT * FROM users WHERE id=$1',[userId])
    const user=result.rows[0]
    if(!user||!await bcrypt.compare(input.currentPassword??'',user.password_hash))throw new BadRequestException('A senha atual está incorreta')
    if(await bcrypt.compare(input.newPassword,user.password_hash))throw new BadRequestException('Escolha uma senha diferente da atual')
    await this.database.query('UPDATE users SET password_hash=$2 WHERE id=$1',[userId,await bcrypt.hash(input.newPassword,12)])
    return this.signOutOthers(userId,token)
  }

  async issueSession(userId:string,workspaceId?:string): Promise<{token:string;session:AuthSession}> {
    const token=randomBytes(32).toString('base64url')
    await this.database.query("INSERT INTO auth_sessions (id,user_id,token_hash,workspace_id,expires_at) VALUES ($1,$2,$3,$4,NOW()+INTERVAL '30 days')",[randomUUID(),userId,hashToken(token),workspaceId??null])
    const {user,workspace}=await this.authenticate(token)
    return {token,session:{user,workspace}}
  }
}
