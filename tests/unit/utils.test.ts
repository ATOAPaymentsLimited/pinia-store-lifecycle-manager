import { vi } from 'vitest'
import { debugLog, devWarnNonWritable, devError } from '../../src/utils'

describe('debugLog', () => {
  afterEach(() => vi.restoreAllMocks())

  it('calls console.log with the 🔄 prefix, store id and message', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    debugLog('myStore', 'test message')
    expect(spy).toHaveBeenCalledWith('🔄 [myStore] test message', '')
  })

  it('appends data to the log when provided', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    debugLog('myStore', 'with data', { key: 'val' })
    expect(spy).toHaveBeenCalledWith('🔄 [myStore] with data', { key: 'val' })
  })

  it('logs an empty string when no data is provided', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    debugLog('myStore', 'no data')
    expect(spy).toHaveBeenCalledWith('🔄 [myStore] no data', '')
  })
})

describe('devWarnNonWritable', () => {
  afterEach(() => vi.restoreAllMocks())

  it('calls console.warn with the 🔄 🚫 prefix', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    devWarnNonWritable('testStore', 'myProp')
    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/^🔄 🚫/))
  })

  it('includes the store id in the warning', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    devWarnNonWritable('testStore', 'myProp')
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('testStore'))
  })

  it('includes the property name in the warning', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    devWarnNonWritable('testStore', 'myProp')
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('myProp'))
  })
})

describe('devError', () => {
  afterEach(() => vi.restoreAllMocks())

  it('calls console.error with the 🔄 [PiniaStoreLifecycleManager] prefix', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    devError('storeX', 'something failed', new Error('oops'))
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('🔄 [PiniaStoreLifecycleManager]'),
      expect.any(Error)
    )
  })

  it('includes the store id in the error message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    devError('storeX', 'something failed', new Error('oops'))
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('storeX'),
      expect.any(Error)
    )
  })

  it('includes the error object as a second argument', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new Error('root cause')
    devError('storeX', 'failed', err)
    expect(spy).toHaveBeenCalledWith(expect.any(String), err)
  })
})
