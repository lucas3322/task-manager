import type { OrbitaskApi } from '@orbitask/contracts'

declare global { interface Window { orbitask: OrbitaskApi } }
export {}
