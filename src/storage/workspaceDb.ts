import { openDB, type DBSchema } from 'idb'
import { z } from 'zod'

import { workspaceSnapshotSchema } from '../domain/schemas'
import { STORAGE_SCHEMA_VERSION, type WorkspaceSnapshot } from '../domain/simulation'

interface EventCityDatabase extends DBSchema {
  workspace: {
    key: 'current'
    value: unknown
  }
}

export type WorkspaceRecoveryFailureReason =
  | 'invalid-json'
  | 'missing-storage-schema-version'
  | 'invalid-storage-schema-version'
  | 'unsupported-older-version'
  | 'unsupported-newer-version'
  | 'invalid-snapshot'

export type WorkspaceRecoveryResult =
  | { status: 'empty' }
  | {
      status: 'recovered'
      snapshot: WorkspaceSnapshot
      sourceVersion: number
      migrated: boolean
    }
  | {
      status: 'rejected'
      reason: WorkspaceRecoveryFailureReason
      detectedVersion?: number
      issues: string[]
    }

export class WorkspaceRecoveryError extends Error {
  readonly result: Extract<WorkspaceRecoveryResult, { status: 'rejected' }>

  constructor(result: Extract<WorkspaceRecoveryResult, { status: 'rejected' }>) {
    super(`Workspace recovery failed: ${result.reason}`)
    this.name = 'WorkspaceRecoveryError'
    this.result = result
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

function rejected(
  reason: WorkspaceRecoveryFailureReason,
  issues: string[],
  detectedVersion?: number,
): Extract<WorkspaceRecoveryResult, { status: 'rejected' }> {
  return detectedVersion === undefined
    ? { status: 'rejected', reason, issues }
    : { status: 'rejected', reason, detectedVersion, issues }
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'snapshot'
    return `${path}: ${issue.message}`
  })
}

function readStorageVersion(candidate: unknown):
  | { success: true; version: number }
  | { success: false; result: WorkspaceRecoveryResult } {
  if (typeof candidate !== 'object' || candidate === null || !('storageSchemaVersion' in candidate)) {
    return {
      success: false,
      result: rejected(
        'missing-storage-schema-version',
        ['storageSchemaVersion: Required'],
      ),
    }
  }

  const version = Reflect.get(candidate, 'storageSchemaVersion')
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1) {
    return {
      success: false,
      result: rejected(
        'invalid-storage-schema-version',
        ['storageSchemaVersion: Expected a positive safe integer'],
      ),
    }
  }

  return { success: true, version }
}

/**
 * Validates and migrates an untrusted persisted value.
 *
 * Version 1 is the current baseline, so its migration is an explicit identity
 * validation. When version 2 is introduced, add a v1 input schema and a v1 ->
 * v2 transform here before changing STORAGE_SCHEMA_VERSION.
 */
export function recoverWorkspace(candidate: unknown): WorkspaceRecoveryResult {
  if (candidate === undefined) return { status: 'empty' }

  const versionResult = readStorageVersion(candidate)
  if (!versionResult.success) return versionResult.result

  const sourceVersion = versionResult.version
  if (sourceVersion < STORAGE_SCHEMA_VERSION) {
    return rejected(
      'unsupported-older-version',
      [`storageSchemaVersion: No migration path from version ${sourceVersion}`],
      sourceVersion,
    )
  }
  if (sourceVersion > STORAGE_SCHEMA_VERSION) {
    return rejected(
      'unsupported-newer-version',
      [`storageSchemaVersion: Version ${sourceVersion} requires a newer application`],
      sourceVersion,
    )
  }

  const parsed = workspaceSnapshotSchema.safeParse(candidate)
  if (!parsed.success) {
    return rejected('invalid-snapshot', formatIssues(parsed.error), sourceVersion)
  }

  return {
    status: 'recovered',
    snapshot: parsed.data,
    sourceVersion,
    migrated: sourceVersion !== STORAGE_SCHEMA_VERSION,
  }
}

export async function saveWorkspace(snapshot: WorkspaceSnapshot): Promise<void> {
  const validSnapshot = workspaceSnapshotSchema.parse(snapshot)
  const database = await getDatabase()
  await database.put(STORE_NAME, validSnapshot, 'current')
}

export async function loadWorkspaceRecovery(): Promise<WorkspaceRecoveryResult> {
  const database = await getDatabase()
  const candidate = await database.get(STORE_NAME, 'current')
  return recoverWorkspace(candidate)
}

/**
 * Compatibility API for existing callers. An empty store still returns null,
 * while rejected persisted data is surfaced as a structured error instead of
 * being silently treated as a new workspace.
 */
export async function loadWorkspace(): Promise<WorkspaceSnapshot | null> {
  const result = await loadWorkspaceRecovery()
  if (result.status === 'empty') return null
  if (result.status === 'rejected') throw new WorkspaceRecoveryError(result)
  return result.snapshot
}

export function serializeWorkspace(snapshot: WorkspaceSnapshot): string {
  return JSON.stringify(workspaceSnapshotSchema.parse(snapshot), null, 2)
}

export function parseWorkspaceJsonRecovery(json: string): WorkspaceRecoveryResult {
  try {
    return recoverWorkspace(JSON.parse(json) as unknown)
  } catch (error) {
    if (error instanceof SyntaxError) {
      return rejected('invalid-json', [error.message])
    }
    throw error
  }
}

/** Compatibility API for the current import flow. */
export function parseWorkspaceJson(json: string): WorkspaceSnapshot {
  const result = parseWorkspaceJsonRecovery(json)
  if (result.status === 'recovered') return result.snapshot
  if (result.status === 'empty') throw new Error('JSON parsing cannot produce an absent value')
  throw new WorkspaceRecoveryError(result)
}
