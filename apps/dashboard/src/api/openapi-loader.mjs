// Registers the resolver that lets openapi-typescript use the TypeScript 5 compiler API.
// The dashboard builds with TypeScript 7, whose package no longer exposes that API, so the
// generator resolves `typescript` to the `typescript5` alias installed for it.
import { register } from 'node:module'

register('./openapi-typescript-hooks.mjs', import.meta.url)
