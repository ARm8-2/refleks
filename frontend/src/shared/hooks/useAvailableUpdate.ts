import { EventsOn } from '@wails/runtime'
import { useSyncExternalStore } from 'react'
import type { UpdateInfo } from '../types'

let availableUpdate: UpdateInfo | null = null
let initialized = false
const listeners = new Set<() => void>()

function emitChange() {
  listeners.forEach(listener => listener())
}

function isUpdateInfo(value: unknown): value is UpdateInfo {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<UpdateInfo>
  return (
    typeof candidate.currentVersion === 'string'
    && typeof candidate.latestVersion === 'string'
    && typeof candidate.hasUpdate === 'boolean'
  )
}

function normalizeAvailableUpdate(info: UpdateInfo | null): UpdateInfo | null {
  return info?.hasUpdate ? info : null
}

function isSameUpdateInfo(left: UpdateInfo | null, right: UpdateInfo | null) {
  return left?.currentVersion === right?.currentVersion
    && left?.latestVersion === right?.latestVersion
    && left?.hasUpdate === right?.hasUpdate
    && left?.downloadUrl === right?.downloadUrl
    && left?.releaseNotes === right?.releaseNotes
}

function ensureInitialized() {
  if (initialized) return

  initialized = true
  EventsOn('update:available', (payload: unknown) => {
    if (!isUpdateInfo(payload)) return
    setAvailableUpdate(payload)
  })
}

function subscribe(listener: () => void) {
  ensureInitialized()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return availableUpdate
}

export function setAvailableUpdate(info: UpdateInfo | null) {
  const next = normalizeAvailableUpdate(info)
  if (isSameUpdateInfo(availableUpdate, next)) return

  availableUpdate = next
  emitChange()
}

export function useAvailableUpdate() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}