import { openDB } from 'idb'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('idb', () => ({ openDB: vi.fn() }))

import {
  APP_VERSION,
  CONTENT_VERSION,
  DEFAULT_CONFIG,
  DEFAULT_MESSAGE,
  KAFKA_RULE_VERSION,
  STORAGE_SCHEMA_VERSION,
  type WorkspaceSnapshot,
} from '../domain/simulation'
import {
  loadWorkspace,
  loadWorkspaceRecovery,
  parseWorkspaceJson,
  parseWorkspaceJsonRecovery,
  recoverWorkspace,
  WorkspaceRecoveryError,
} from './workspaceDb'

const openDatabaseMock = vi.mocked(openDB)

function makeSnapshot(overrides: Partial<WorkspaceSnapshot> = {}): WorkspaceSnapshot {
  return {
    storageSchemaVersion: STORAGE_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    contentVersion: CONTENT_VERSION,
    kafkaRuleVersion: KAFKA_RULE_VERSION,
    savedAt: '2026-08-18T00:00:00.000Z',
    config: DEFAULT_CONFIG,
    message: DEFAULT_MESSAGE,
    runs: [],
    hintLevel: 0,
    chapterCompleted: false,
    ...overrides,
  }
}

describe('workspace recovery', () => {
  beforeEach(() => {
    openDatabaseMock.mockReset()
  })

  it('recovers schema v1 data independently of app and content versions', () => {
    const snapshot = makeSnapshot({
      appVersion: '0.0.1',
      contentVersion: '2025.4',
      kafkaRuleVersion: '3.9.0',
    })

    expect(recoverWorkspace(snapshot)).toEqual({
      status: 'recovered',
      snapshot,
      sourceVersion: 1,
      migrated: false,
    })
  })

  it('distinguishes an unsupported newer schema from corrupt data', () => {
    const result = recoverWorkspace({ ...makeSnapshot(), storageSchemaVersion: 2 })

    expect(result).toMatchObject({
      status: 'rejected',
      reason: 'unsupported-newer-version',
      detectedVersion: 2,
    })
  })

  it('returns validation issues for a corrupt current-version snapshot', () => {
    const result = recoverWorkspace({ ...makeSnapshot(), runs: 'not-an-array' })

    expect(result).toMatchObject({
      status: 'rejected',
      reason: 'invalid-snapshot',
      detectedVersion: 1,
    })
    if (result.status === 'rejected') {
      expect(result.issues.some((issue) => issue.startsWith('runs:'))).toBe(true)
    }
  })

  it('identifies missing and invalid storage schema versions', () => {
    expect(recoverWorkspace({})).toMatchObject({
      status: 'rejected',
      reason: 'missing-storage-schema-version',
    })
    expect(recoverWorkspace(null)).toMatchObject({
      status: 'rejected',
      reason: 'missing-storage-schema-version',
    })
    expect(recoverWorkspace({ storageSchemaVersion: '1' })).toMatchObject({
      status: 'rejected',
      reason: 'invalid-storage-schema-version',
    })
  })

  it('returns a structured reason for malformed JSON', () => {
    expect(parseWorkspaceJsonRecovery('{')).toMatchObject({
      status: 'rejected',
      reason: 'invalid-json',
    })
  })

  it('keeps the legacy JSON parser API while exposing recovery details in errors', () => {
    expect(parseWorkspaceJson(JSON.stringify(makeSnapshot()))).toEqual(makeSnapshot())

    try {
      parseWorkspaceJson(JSON.stringify({ ...makeSnapshot(), storageSchemaVersion: 2 }))
      throw new Error('Expected parseWorkspaceJson to reject the newer schema')
    } catch (error) {
      expect(error).toBeInstanceOf(WorkspaceRecoveryError)
      expect((error as WorkspaceRecoveryError).result.reason).toBe('unsupported-newer-version')
    }
  })

  it('returns detailed recovery results from IndexedDB', async () => {
    openDatabaseMock.mockResolvedValue({
      get: vi.fn().mockResolvedValue({ ...makeSnapshot(), runs: 'corrupt' }),
    } as never)

    await expect(loadWorkspaceRecovery()).resolves.toMatchObject({
      status: 'rejected',
      reason: 'invalid-snapshot',
      detectedVersion: 1,
    })
  })

  it('keeps the legacy load API and surfaces rejected IndexedDB data as an error', async () => {
    openDatabaseMock.mockResolvedValue({
      get: vi.fn().mockResolvedValue({ ...makeSnapshot(), storageSchemaVersion: 2 }),
    } as never)

    await expect(loadWorkspace()).rejects.toMatchObject({
      name: 'WorkspaceRecoveryError',
      result: { reason: 'unsupported-newer-version', detectedVersion: 2 },
    })
  })
})
