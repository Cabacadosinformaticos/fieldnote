import * as SecureStore from 'expo-secure-store';

const SAVED_CODE_KEY = 'fieldnote.join.saved-code';

/**
 * A code invitation is not stored on the server before acceptance, so the phone keeps it when
 * the participant chooses "Decidir mais tarde" (FR-72).
 */
export async function saveInviteCode(code: string): Promise<void> {
  await SecureStore.setItemAsync(SAVED_CODE_KEY, code).catch(() => undefined);
}

export async function readInviteCode(): Promise<string | null> {
  return SecureStore.getItemAsync(SAVED_CODE_KEY).catch(() => null);
}

export async function clearInviteCode(): Promise<void> {
  await SecureStore.deleteItemAsync(SAVED_CODE_KEY).catch(() => undefined);
}
