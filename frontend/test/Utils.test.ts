import { formatPct, formatPct01, formatSeconds } from '../src/lib/utils'

describe('format helpers', () => {
  test('formatPct handles fractional and percentage inputs', () => {
    expect(formatPct(0.834)).toBe('83.4%')
    expect(formatPct(83.4)).toBe('83.4%')
    expect(formatPct('0.834')).toBe('83.4%')
    expect(formatPct('83.4')).toBe('83.4%')
    expect(formatPct(0)).toBe('0.0%')
    expect(formatPct(1)).toBe('100.0%')
    expect(formatPct(NaN)).toBe('—')
  })

  test('formatPct01 works as before', () => {
    expect(formatPct01(0.834)).toBe('83.4%')
    expect(formatPct01('0.834')).toBe('83.4%')
    expect(formatPct01(0)).toBe('0.0%')
    expect(formatPct01(NaN)).toBe('—')
  })

  test('formatSeconds', () => {
    expect(formatSeconds(1.23456)).toBe('1.23s')
    expect(formatSeconds('1.23456')).toBe('1.23s')
    expect(formatSeconds(NaN)).toBe('—')
  })
})
