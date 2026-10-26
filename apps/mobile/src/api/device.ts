import * as Application from 'expo-application';
import { Platform } from 'react-native';

/**
 * Android ID used only for the joining-twice check (FR-105). The server hashes it with the
 * study salt, so it never reaches the API as an identifier the study can read.
 */
export function getAndroidId(): string | undefined {
  if (Platform.OS !== 'android') {
    return undefined;
  }

  try {
    return Application.getAndroidId() || undefined;
  } catch {
    return undefined;
  }
}
