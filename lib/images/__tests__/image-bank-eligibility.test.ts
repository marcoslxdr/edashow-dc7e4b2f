import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isAssetEligible } from '../image-bank-eligibility'

test('never used is eligible', () => {
  assert.equal(isAssetEligible(null, new Date('2026-05-27'), 45), true)
})

test('used 44 days ago is not eligible', () => {
  const now = new Date('2026-05-27T12:00:00Z')
  const last = new Date('2026-04-14T12:00:00Z')
  assert.equal(isAssetEligible(last, now, 45), false)
})

test('used 46 days ago is eligible', () => {
  const now = new Date('2026-05-27T12:00:00Z')
  const last = new Date('2026-04-10T12:00:00Z')
  assert.equal(isAssetEligible(last, now, 45), true)
})
