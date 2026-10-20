// Placeholder until the auth slice wires the API. Kept here so the page already
// calls the function that will later perform the real request.
export async function signIn(_email: string, _password: string): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 500)
  })
}
