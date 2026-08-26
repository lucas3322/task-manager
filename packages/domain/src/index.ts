import type { Task } from '@orbitask/contracts'

export function wouldCreateDependencyCycle(
  tasks: Pick<Task, 'id'>[],
  dependencies: Array<{ taskId: string; dependsOnTaskId: string }>,
  taskId: string,
  dependsOnTaskId: string,
): boolean {
  if (taskId === dependsOnTaskId) return true
  const edges = new Map<string, string[]>()
  for (const task of tasks) edges.set(task.id, [])
  for (const dependency of dependencies) {
    edges.get(dependency.taskId)?.push(dependency.dependsOnTaskId)
  }
  edges.get(taskId)?.push(dependsOnTaskId)

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true
    if (visited.has(id)) return false
    visiting.add(id)
    for (const next of edges.get(id) ?? []) if (visit(next)) return true
    visiting.delete(id)
    visited.add(id)
    return false
  }
  return tasks.some((task) => visit(task.id))
}

export function isValidStatusTransition(
  from: string,
  to: string,
  transitions: Array<{ fromStatusId: string; toStatusId: string }>,
): boolean {
  return from === to || transitions.some((item) => item.fromStatusId === from && item.toStatusId === to)
}
