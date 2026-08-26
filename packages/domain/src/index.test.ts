import { describe, expect, it } from 'vitest'
import { isValidStatusTransition, wouldCreateDependencyCycle } from '.'

describe('dependency rules', () => {
  const tasks = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  it('rejects direct and indirect cycles', () => {
    expect(wouldCreateDependencyCycle(tasks, [], 'a', 'a')).toBe(true)
    expect(wouldCreateDependencyCycle(tasks, [{ taskId: 'a', dependsOnTaskId: 'b' }, { taskId: 'b', dependsOnTaskId: 'c' }], 'c', 'a')).toBe(true)
  })
  it('allows an acyclic dependency', () => {
    expect(wouldCreateDependencyCycle(tasks, [{ taskId: 'a', dependsOnTaskId: 'b' }], 'a', 'c')).toBe(false)
  })
})

describe('workflow rules', () => {
  const transitions = [{ fromStatusId: 'todo', toStatusId: 'doing' }]
  it('allows configured transitions and rejects others', () => {
    expect(isValidStatusTransition('todo', 'doing', transitions)).toBe(true)
    expect(isValidStatusTransition('doing', 'todo', transitions)).toBe(false)
  })
})
