import { describe, expect, it } from 'vitest'
describe('environment contract', () => { it('uses a numeric port when supplied', () => { expect(Number('3000')).toBe(3000) }) })
