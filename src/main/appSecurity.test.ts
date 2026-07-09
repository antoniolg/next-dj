import { describe, expect, it } from 'vitest'
import { isAllowedSessionPermission } from './appSecurity.js'

describe('app security policy', () => {
  it('allows only the permissions required by recording and audio devices', () => {
    expect(isAllowedSessionPermission('media')).toBe(true)
    expect(isAllowedSessionPermission('display-capture')).toBe(true)
    expect(isAllowedSessionPermission('geolocation')).toBe(false)
    expect(isAllowedSessionPermission('notifications')).toBe(false)
  })
})
