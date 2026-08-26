import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common'
import type { User, Workspace } from '@orbitask/contracts'
import { AuthService } from './auth.service.js'

export interface AuthContext { user:User; workspace:Workspace; token:string }
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth:AuthService) {}
  async canActivate(context:ExecutionContext) {
    const request=context.switchToHttp().getRequest<{headers:{authorization?:string};auth?:AuthContext}>()
    const value=request.headers.authorization
    if (!value?.startsWith('Bearer ')) throw new UnauthorizedException('Autenticação necessária')
    const token=value.slice(7); request.auth={...await this.auth.authenticate(token),token}; return true
  }
}
export const CurrentAuth=createParamDecorator((_data,ctx:ExecutionContext)=>ctx.switchToHttp().getRequest().auth as AuthContext)
