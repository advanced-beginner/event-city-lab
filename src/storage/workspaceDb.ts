import { openDB, type DBSchema } from 'idb'

import { workspaceSnapshotSchema } from '../domain/schemas'
import type { WorkspaceSnapshot } from '../domain/simulation'

interface EventCityDatabase extends DBSchema {
  workspace: {
    key: 'current'
    value: WorkspaceSnapshot
  }
}

const DATABASE_NAME = 'event-city-lab-v1'
const STORE_NAME = 'workspace'

async function getDatabase() {
  return openDB<EventCityDatabase>(DATABASE_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME)
      }
    },
  })
}

export async function saveWorkspace(snapshot: WorkspaceSnapshot): Promise<void> {
  const validSnapshot = workspaceSnapshotSchema.parse(snapshot)
  const database = await getDatabase()
  await database.put(STORE_NAME, validSnapshot, 'current')
}

export async function loadWorkspace(): Promise<WorkspaceSnapshot | null> {
  const database = await getDatabase()
  const candidate = await database.get(STORE_NAME, 'current')
  if (!candidate) return null

  const parsed = workspaceSnapshotSchema.safeParse(candidate)
  if (!parsed.success) {
    return null
  }
  return parsed.data
}

export function serializeWorkspace(snapshot: WorkspaceSnapshot): string {
  return JSON.stringify(workspaceSnapshotSchema.parse(snapshot), null, 2)
}

export function parseWorkspaceJson(json: string): WorkspaceSnapshot {
  return workspaceSnapshotSchema.parse(JSON.parse(json) as unknown)
}
