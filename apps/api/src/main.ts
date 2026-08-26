import 'reflect-metadata'
import { Controller, Get, Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'

@Controller()
class HealthController { @Get('health') health() { return { status:'ok', service:'orbitask-api', version:process.env.npm_package_version ?? '0.1.0' } } }
@Module({ imports:[AppModule], controllers:[HealthController] })
class BootstrapModule {}

const app = await NestFactory.create(BootstrapModule)
app.enableCors({ origin:(process.env.ALLOWED_ORIGINS ?? 'http://localhost:4173').split(',').map((item)=>item.trim()), credentials:true })
app.enableShutdownHooks()
await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0')
