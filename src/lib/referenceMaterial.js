// src/lib/referenceMaterial.js — inject bundled reference corpora into accelerator prompts.

import {
  KATALON_LIBRARIES,
  KATALON_PRODUCT_LIBS,
  KATALON_SHARED_LIBS
} from './katalonReference.generated.js'
import {
  CODE_REVIEW_PROFILE_MAP,
  GW_STANDARDS_DOCS,
  SKI_RELEASE_DOCS,
  SKI_RELEASE_SLUGS
} from './gwReference.generated.js'

const KATALON_HEADER = `REFERENCE MATERIAL — Guidewire Flow Automation Katalon accelerator bundled in this repo.
Use the exact @Keyword method signatures below. Reuse these methods by name; only add new keywords when the flow truly needs them, and list additions in keywordAdditions.`

const CODE_REVIEW_HEADER = `REFERENCE MATERIAL — Guidewire Cloud review standards bundled in this repo.
Apply these rules when calibrating findings. Cite the matching standard in standardRef. Do not invent release-specific deprecations unless stated in the reference.`

const RELEASE_HEADER = `REFERENCE MATERIAL — Guidewire Cloud ski-release upgrade themes bundled in this repo.
Use for planning and regression focus. Where specifics are uncertain, direct the team to verify against official release notes for the target ski release.`

function unique(keys) {
  return [...new Set(keys)]
}

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
  return `${KATALON_HEADER}\n\n${sections.join('\n\n')}`
}

/** GW Cloud standards for selected review profiles. */
export function getCodeReviewReference(profiles = []) {
  const docKeys = unique(
    profiles.flatMap((id) => CODE_REVIEW_PROFILE_MAP[id] || [])
  )
  if (!docKeys.length) {
    docKeys.push('cross-cutting')
  }
  const sections = docKeys.map((key) => {
    const body = GW_STANDARDS_DOCS[key]
    return body ? `--- ${key}.md ---\n${body}` : null
  }).filter(Boolean)
  return `${CODE_REVIEW_HEADER}\n\n${sections.join('\n\n')}`
}

/** Ski-release upgrade themes for a target release and products. */
export function getReleaseNavigatorReference(release = 'Palisades', products = []) {
  const slug = SKI_RELEASE_SLUGS[release] || 'next'
  const sections = []
  if (SKI_RELEASE_DOCS.common) {
    sections.push(`--- common.md ---\n${SKI_RELEASE_DOCS.common}`)
  }
  if (SKI_RELEASE_DOCS[slug]) {
    sections.push(`--- ${slug}.md ---\n${SKI_RELEASE_DOCS[slug]}`)
  }
  const productLine = products.length
    ? `Products in scope for this analysis: ${products.join(', ')}.`
    : 'Products in scope: not specified — assess cross-suite themes.'
  return `${RELEASE_HEADER}\n\n${productLine}\n\n${sections.join('\n\n')}`
}

/** Append Katalon reference to a module system prompt. */
export function withKatalonReference(systemPrompt, product = 'PolicyCenter') {
  return `${systemPrompt}\n\n${getKatalonReference(product)}`
}

/** Append GW standards reference for selected review profiles. */
export function withCodeReviewReference(systemPrompt, profiles = []) {
  return `${systemPrompt}\n\n${getCodeReviewReference(profiles)}`
}

/** Append ski-release reference for the target release. */
export function withReleaseNavigatorReference(systemPrompt, { release, products } = {}) {
  return `${systemPrompt}\n\n${getReleaseNavigatorReference(release, products)}`
}

/** True when Test Migrator should load the Katalon corpus. */
export function isKatalonFramework(framework) {
  return (framework || '').toLowerCase().includes('katalon')
}
