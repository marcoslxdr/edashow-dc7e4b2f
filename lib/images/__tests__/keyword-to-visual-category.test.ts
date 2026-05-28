import { test } from 'node:test'
import assert from 'node:assert/strict'
import { keywordToVisualCategorySlug } from '../keyword-to-visual-category'

test('maps odontologia', () => {
  assert.equal(keywordToVisualCategorySlug('plano odontológico'), 'odontologia')
})

test('maps maternidade', () => {
  assert.equal(keywordToVisualCategorySlug('cobertura de parto plano de saúde'), 'maternidade')
})

test('default bem-estar', () => {
  assert.equal(keywordToVisualCategorySlug('plano de saúde referência'), 'bem-estar')
})

test('maps exames', () => {
  assert.equal(keywordToVisualCategorySlug('cobertura de ressonância magnética'), 'exames')
})
