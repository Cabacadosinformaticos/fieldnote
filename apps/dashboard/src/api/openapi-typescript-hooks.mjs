export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'typescript') {
    return nextResolve('typescript5', context)
  }
  return nextResolve(specifier, context)
}
