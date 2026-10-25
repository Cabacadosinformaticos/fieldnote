// The OpenAPI document declares paths under /api/v1. The client already prefixes every request
// with that base URL, so the generated path keys are made relative to it.
import { readFileSync, writeFileSync } from 'node:fs'

const schemaPath = new URL('./schema.d.ts', import.meta.url)
const source = readFileSync(schemaPath, 'utf8')
writeFileSync(schemaPath, source.replaceAll('"/api/v1/', '"/'))
