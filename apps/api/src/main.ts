import 'reflect-metadata'
import { readFileSync } from 'node:fs'
import { Controller, Get, Module, Redirect } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'

// dist/main.js e src/main.ts ficam um nível abaixo do package.json da API.
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }

@Controller()
class HealthController {
  @Get()
  @Redirect(process.env.ORBITASK_WEB_URL ?? 'https://handsome-upliftment-production-4492.up.railway.app/')
  webApp() {}

  @Get('health')
  health() { return { status:'ok', service:'orbitask-api', version } }
}
@Module({ imports:[AppModule], controllers:[HealthController] })
class BootstrapModule {}

const app = await NestFactory.create(BootstrapModule)
app.enableCors({ origin:(process.env.ALLOWED_ORIGINS ?? 'http://localhost:4173').split(',').map((item)=>item.trim()), credentials:true })
app.enableShutdownHooks()
await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0')
