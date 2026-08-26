import { app, safeStorage } from 'electron'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
const path=()=>join(app.getPath('userData'),'session.bin')
export async function saveToken(token:string){const data=safeStorage.isEncryptionAvailable()?safeStorage.encryptString(token):Buffer.from(token);await writeFile(path(),data,{mode:0o600})}
export async function loadToken(){try{const data=await readFile(path());return safeStorage.isEncryptionAvailable()?safeStorage.decryptString(data):data.toString()}catch{return null}}
export async function clearToken(){try{await unlink(path())}catch{}}
