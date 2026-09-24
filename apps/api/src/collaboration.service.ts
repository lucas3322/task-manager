import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import bcrypt from 'bcryptjs'
import type { User, WorkspaceInvite, WorkspaceMember, WorkspaceRole } from '@orbitask/contracts'
import { AuthService } from './auth.service.js'
import { DatabaseService } from './database.service.js'

const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex')
const roles:WorkspaceRole[]=['admin','member','guest']

@Injectable()
export class CollaborationService {
  constructor(private readonly database:DatabaseService,private readonly auth:AuthService){}

  private requireAdmin(role:WorkspaceRole){if(role!=='admin')throw new ForbiddenException('Somente administradores podem gerenciar a equipe')}

  async list(workspaceId:string,actorRole:WorkspaceRole):Promise<{members:WorkspaceMember[];invites:WorkspaceInvite[]}>{
    const members=await this.database.query<{user_id:string;name:string;email:string;avatar_url:string|null;role:WorkspaceRole;created_at:string;project_ids:string[]}>(`SELECT u.id user_id,u.name,u.email,u.avatar_url,wm.role,wm.created_at,COALESCE(array_agg(pm.project_id::text) FILTER (WHERE pm.project_id IS NOT NULL),'{}') project_ids FROM workspace_members wm JOIN users u ON u.id=wm.user_id LEFT JOIN project_members pm ON pm.user_id=u.id AND pm.project_id IN (SELECT id FROM projects WHERE workspace_id=wm.workspace_id) WHERE wm.workspace_id=$1 GROUP BY u.id,u.name,u.email,u.avatar_url,wm.role,wm.created_at ORDER BY wm.created_at`,[workspaceId])
    const mappedMembers=members.rows.map(row=>({userId:row.user_id,name:row.name,email:row.email,avatarUrl:row.avatar_url,role:row.role,projectIds:row.project_ids,createdAt:new Date(row.created_at).toISOString()}))
    if(actorRole!=='admin')return{members:mappedMembers,invites:[]}
    const invites=await this.database.query<{id:string;email:string;role:WorkspaceRole;invited_by_name:string;expires_at:string;created_at:string;project_ids:string[]}>(`SELECT wi.id,wi.email,wi.role,u.name invited_by_name,wi.expires_at,wi.created_at,COALESCE(array_agg(ip.project_id::text) FILTER (WHERE ip.project_id IS NOT NULL),'{}') project_ids FROM workspace_invites wi JOIN users u ON u.id=wi.invited_by LEFT JOIN invite_projects ip ON ip.invite_id=wi.id WHERE wi.workspace_id=$1 AND wi.accepted_at IS NULL AND wi.expires_at>NOW() GROUP BY wi.id,u.name ORDER BY wi.created_at DESC`,[workspaceId])
    return{members:mappedMembers,invites:invites.rows.map(row=>({id:row.id,email:row.email,role:row.role,projectIds:row.project_ids,invitedByName:row.invited_by_name,expiresAt:new Date(row.expires_at).toISOString(),createdAt:new Date(row.created_at).toISOString()}))}
  }

  async invite(workspaceId:string,actorId:string,actorRole:WorkspaceRole,input:{email:string;role:WorkspaceRole;projectIds?:string[]}):Promise<WorkspaceInvite>{
    this.requireAdmin(actorRole)
    const email=input.email?.trim().toLowerCase(),role=input.role
    if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new BadRequestException('Informe um e-mail válido')
    if(!roles.includes(role))throw new BadRequestException('Papel inválido')
    const projectIds=role==='guest'?[...new Set(input.projectIds??[])]:[]
    if(role==='guest'&&!projectIds.length)throw new BadRequestException('Selecione ao menos um projeto para o convidado')
    const valid=await this.database.query<{id:string}>('SELECT id FROM projects WHERE workspace_id=$1 AND id=ANY($2::uuid[])',[workspaceId,projectIds])
    if(valid.rowCount!==projectIds.length)throw new BadRequestException('Um dos projetos selecionados não pertence ao workspace')
    const member=await this.database.query('SELECT 1 FROM workspace_members wm JOIN users u ON u.id=wm.user_id WHERE wm.workspace_id=$1 AND u.email=$2',[workspaceId,email])
    if(member.rowCount)throw new BadRequestException('Este usuário já faz parte do workspace')
    const id=randomUUID(),token=randomBytes(32).toString('base64url')
    await this.database.transaction(async query=>{
      await query('DELETE FROM workspace_invites WHERE workspace_id=$1 AND email=$2 AND accepted_at IS NULL',[workspaceId,email])
      await query("INSERT INTO workspace_invites (id,workspace_id,email,role,token_hash,invited_by,expires_at) VALUES ($1,$2,$3,$4,$5,$6,NOW()+INTERVAL '7 days')",[id,workspaceId,email,role,hashToken(token),actorId])
      for(const projectId of projectIds)await query('INSERT INTO invite_projects (invite_id,project_id) VALUES ($1,$2)',[id,projectId])
    })
    const actor=await this.database.query<{name:string}>('SELECT name FROM users WHERE id=$1',[actorId])
    const now=Date.now(),base=(process.env.PUBLIC_APP_URL??'http://localhost:4173').replace(/\/$/,'')
    return{id,email,role,projectIds,invitedByName:actor.rows[0].name,createdAt:new Date(now).toISOString(),expiresAt:new Date(now+7*86400000).toISOString(),inviteUrl:`${base}/app?convite=${encodeURIComponent(token)}`}
  }

  async inspectInvite(token:string){
    const result=await this.database.query<{email:string;role:WorkspaceRole;workspace_name:string;invited_by_name:string;expires_at:string}>(`SELECT wi.email,wi.role,w.name workspace_name,u.name invited_by_name,wi.expires_at FROM workspace_invites wi JOIN workspaces w ON w.id=wi.workspace_id JOIN users u ON u.id=wi.invited_by WHERE wi.token_hash=$1 AND wi.accepted_at IS NULL AND wi.expires_at>NOW()`,[hashToken(token)])
    const row=result.rows[0];if(!row)throw new NotFoundException('Convite inválido ou expirado')
    return{email:row.email,role:row.role,workspaceName:row.workspace_name,invitedByName:row.invited_by_name,expiresAt:new Date(row.expires_at).toISOString()}
  }

  async acceptInvite(token:string,input:{name?:string;password:string}){
    const invite=await this.database.query<{id:string;workspace_id:string;email:string;role:WorkspaceRole}>(`SELECT id,workspace_id,email,role FROM workspace_invites WHERE token_hash=$1 AND accepted_at IS NULL AND expires_at>NOW() FOR UPDATE`,[hashToken(token)])
    const row=invite.rows[0];if(!row)throw new NotFoundException('Convite inválido ou expirado')
    let user=await this.database.query<{id:string;password_hash:string}>('SELECT id,password_hash FROM users WHERE email=$1',[row.email])
    let userId=user.rows[0]?.id
    if(userId){if(!await bcrypt.compare(input.password??'',user.rows[0].password_hash))throw new UnauthorizedException('Senha inválida para este e-mail')}
    else{
      const name=input.name?.trim();if(!name||name.length<2)throw new BadRequestException('Informe seu nome');if(!input.password||input.password.length<8)throw new BadRequestException('A senha deve ter pelo menos 8 caracteres')
      userId=randomUUID();const passwordHash=await bcrypt.hash(input.password,12)
      await this.database.query('INSERT INTO users (id,name,email,password_hash) VALUES ($1,$2,$3,$4)',[userId,name,row.email,passwordHash])
    }
    await this.database.transaction(async query=>{
      await query('INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ($1,$2,$3) ON CONFLICT (workspace_id,user_id) DO UPDATE SET role=EXCLUDED.role',[row.workspace_id,userId,row.role])
      if(row.role==='guest')await query('INSERT INTO project_members (project_id,user_id) SELECT project_id,$2 FROM invite_projects WHERE invite_id=$1 ON CONFLICT DO NOTHING',[row.id,userId])
      await query('UPDATE workspace_invites SET accepted_at=NOW() WHERE id=$1',[row.id])
    })
    return this.auth.issueSession(userId,row.workspace_id)
  }

  async updateMember(workspaceId:string,actorId:string,actorRole:WorkspaceRole,userId:string,input:{role:WorkspaceRole;projectIds?:string[]}):Promise<WorkspaceMember>{
    this.requireAdmin(actorRole);if(!roles.includes(input.role))throw new BadRequestException('Papel inválido')
    const projectIds=input.role==='guest'?[...new Set(input.projectIds??[])]:[]
    if(input.role==='guest'&&!projectIds.length)throw new BadRequestException('Selecione ao menos um projeto para o convidado')
    const target=await this.database.query<{role:WorkspaceRole}>('SELECT role FROM workspace_members WHERE workspace_id=$1 AND user_id=$2',[workspaceId,userId]);if(!target.rowCount)throw new NotFoundException('Membro não encontrado')
    if(userId===actorId&&input.role!=='admin')throw new BadRequestException('Você não pode remover sua própria função de administrador')
    const valid=await this.database.query('SELECT 1 FROM projects WHERE workspace_id=$1 AND id=ANY($2::uuid[])',[workspaceId,projectIds]);if(valid.rowCount!==projectIds.length)throw new BadRequestException('Projeto inválido')
    await this.database.transaction(async query=>{await query('UPDATE workspace_members SET role=$3 WHERE workspace_id=$1 AND user_id=$2',[workspaceId,userId,input.role]);await query('DELETE FROM project_members WHERE user_id=$1 AND project_id IN (SELECT id FROM projects WHERE workspace_id=$2)',[userId,workspaceId]);for(const id of projectIds)await query('INSERT INTO project_members (project_id,user_id) VALUES ($1,$2)',[id,userId])})
    const data=await this.list(workspaceId,actorRole);return data.members.find(item=>item.userId===userId)!
  }

  async removeMember(workspaceId:string,actorId:string,actorRole:WorkspaceRole,userId:string){this.requireAdmin(actorRole);if(userId===actorId)throw new BadRequestException('Você não pode remover a si mesmo');const result=await this.database.query('DELETE FROM workspace_members WHERE workspace_id=$1 AND user_id=$2',[workspaceId,userId]);if(!result.rowCount)throw new NotFoundException('Membro não encontrado')}
  async revokeInvite(workspaceId:string,actorRole:WorkspaceRole,id:string){this.requireAdmin(actorRole);const result=await this.database.query('DELETE FROM workspace_invites WHERE id=$1 AND workspace_id=$2 AND accepted_at IS NULL',[id,workspaceId]);if(!result.rowCount)throw new NotFoundException('Convite não encontrado')}
  async updateProfile(userId:string,input:{name:string;avatarUrl?:string|null}):Promise<User>{const name=input.name?.trim();if(!name||name.length<2)throw new BadRequestException('Informe seu nome');if(input.avatarUrl){try{new URL(input.avatarUrl)}catch{throw new BadRequestException('Informe uma URL válida para o avatar')}}const result=await this.database.query<{id:string;name:string;email:string;avatar_url:string|null;created_at:string}>('UPDATE users SET name=$2,avatar_url=$3 WHERE id=$1 RETURNING id,name,email,avatar_url,created_at',[userId,name,input.avatarUrl?.trim()||null]);const row=result.rows[0];return{id:row.id,name:row.name,email:row.email,avatarUrl:row.avatar_url,createdAt:new Date(row.created_at).toISOString()}}
}
