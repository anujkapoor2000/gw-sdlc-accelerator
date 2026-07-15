// src/lib/referenceMaterial.js — inject bundled Katalon source into accelerator prompts.

import {
  KATALON_LIBRARIES,
  KATALON_PRODUCT_LIBS,
  KATALON_SHARED_LIBS
} from './katalonReference.generated.js'

const REFERENCE_HEADER = `REFERENCE MATERIAL — Guidewire Flow Automation Katalon accelerator bundled in this repo.
Use the exact @Keyword method signatures below. Reuse these methods by name; only add new keywords when the flow truly needs them, and list additions in keywordAdditions.`

function productLibKeys(product) {
  const mapping = KATALON_PRODUCT_LIBS[product] || KATALON_PRODUCT_LIBS.PolicyCenter
  return Array.isArray(mapping) ? mapping : [mapping]
}

/** Groovy source blocks for a product plus shared interaction layers. */
export function getKatalonReference(product = 'PolicyCenter') {
  const sections = []
  for (const lib of KATALON_SHARED_LIBS) {
    sections.push(`--- ${lib}.groovy ---\n${KATALON_LIBRARIES[lib]}`)
  }
  for (const lib of productLibKeys(product)) {
    sections.push(`--- ${lib}.groovy ---\n${KATALON_LIBRARIES[lib]}`)
  }
  return `${REFERENCE_HEADER}\n\n${sections.join('\n\n')}`
}

/** Append Katalon reference to a module system prompt. */
export function withKatalonReference(systemPrompt, product = 'PolicyCenter') {
  return `${systemPrompt}\n\n${getKatalonReference(product)}`
}

/** True when Test Migrator should load the Katalon corpus. */
export function isKatalonFramework(framework) {
  return (framework || '').toLowerCase().includes('katalon')
}
