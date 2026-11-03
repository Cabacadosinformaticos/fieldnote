import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { InstructionCard } from '@/components/daily/InstructionCard';
import { RecordHeader } from '@/components/daily/RecordHeader';
import { td } from '@/i18n/td';
import { useCachedActivity } from '@/queue/hooks';
import { mimeTypeForUri, saveEntry } from '@/queue/save';
import { colors, fonts, radii, spacing } from '@/theme';

const LIMIT_MS = 60_000;
const METERS = Array.from({ length: 24 }, (_, index) => index);

type Phase = 'idle' | 'recording' | 'stopping' | 'recorded';
type Mode = 'audio' | 'text';

type RecordedAudio = {
  uri: string;
  durationMs: number;
};

function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function meterLevel(metering: number | undefined): number {
  if (metering === undefined || !Number.isFinite(metering)) {
    return 0.08;
  }
  const normalized = (metering + 80) / 80;
  return Math.min(1, Math.max(0.06, normalized));
}

export default function AudioRecordScreen() {
  const { activityId, promptId } = useLocalSearchParams<{
    activityId: string;
    promptId?: string;
  }>();
  const { activity, loading } = useCachedActivity(activityId, promptId);
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const recorderState = useAudioRecorderState(recorder, 200);
  const startedAt = useRef(0);
  const [permission, setPermission] = useState<
    Awaited<ReturnType<typeof getRecordingPermissionsAsync>> | null
  >(null);
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [mode, setMode] = useState<Mode>('audio');
  const [recording, setRecording] = useState<RecordedAudio | null>(null);
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getRecordingPermissionsAsync()
      .then((next) => {
        if (mounted) {
          setPermission(next);
        }
      })
      .catch(() => {
        if (mounted) {
          setError(td('record.microphone.error'));
        }
      })
      .finally(() => {
        if (mounted) {
          setPermissionChecked(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(
    () => () => {
      void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    },
    [],
  );

  const stopRecording = useCallback(async () => {
    if (phase !== 'recording') {
      return;
    }
    setPhase('stopping');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        throw new Error('audio_missing');
      }
      setRecording({
        uri,
        durationMs: Math.min(LIMIT_MS, Date.now() - startedAt.current),
      });
      setPhase('recorded');
    } catch {
      setError(td('record.audio.captureError'));
      setPhase('idle');
    } finally {
      await setAudioModeAsync({ allowsRecording: false }).catch(
        () => undefined,
      );
    }
  }, [phase, recorder]);

  useEffect(() => {
    if (phase !== 'recording' || recorderState.durationMillis < LIMIT_MS) {
      return;
    }
    const timer = setTimeout(() => {
      void stopRecording();
    }, 0);
    return () => clearTimeout(timer);
  }, [phase, recorderState.durationMillis, stopRecording]);

  if (loading) {
    return (
      <Screen contentStyle={styles.content} edges={['top']}>
        <StatusBar style="dark" />
        <RecordHeader eyebrow={td('tabs.today')} title={td('record.loading')} />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primaryDark} />
        </View>
      </Screen>
    );
  }

  if (!activity) {
    return (
      <Screen contentStyle={styles.content} edges={['top']}>
        <StatusBar style="dark" />
        <RecordHeader eyebrow={td('tabs.today')} title={td('record.notFound')} />
        <View style={styles.body}>
          <Text style={styles.message}>{td('record.notFoundBody')}</Text>
        </View>
      </Screen>
    );
  }

  if (!activity.captureTypes.includes('audio')) {
    return (
      <Screen contentStyle={styles.content} edges={['top']}>
        <StatusBar style="dark" />
        <RecordHeader eyebrow={activity.studyTitle} title={activity.title} />
        <View style={styles.body}>
          <Text style={styles.message}>{td('record.typeUnavailable')}</Text>
        </View>
      </Screen>
    );
  }

  const granted = permission?.granted === true;
  const canSwitchToText = activity.captureTypes.includes('text');

  const startRecording = async () => {
    if (!granted || phase !== 'idle') {
      return;
    }
    setError(null);
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      startedAt.current = Date.now();
      recorder.record();
      setPhase('recording');
    } catch {
      setError(td('record.audio.captureError'));
      setPhase('idle');
      await setAudioModeAsync({ allowsRecording: false }).catch(
        () => undefined,
      );
    }
  };

  const discard = () => {
    setRecording(null);
    setError(null);
    setPhase('idle');
  };

  const saveAudio = async () => {
    if (!recording || saving) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const entryId = await saveEntry({
        activity,
        type: 'audio',
        mediaUris: [
          {
            uri: recording.uri,
            mimeType: mimeTypeForUri(recording.uri, 'audio'),
          },
        ],
      });
      router.replace({ pathname: '/record/saved', params: { id: entryId } });
    } catch {
      setError(td('record.saveError'));
      setSaving(false);
    }
  };

  const saveText = async () => {
    if (saving || !answer.trim()) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const entryId = await saveEntry({ activity, type: 'text', body: answer });
      router.replace({ pathname: '/record/saved', params: { id: entryId } });
    } catch {
      setError(td('record.saveError'));
      setSaving(false);
    }
  };

  const level = meterLevel(recorderState.metering);

  return (
    <Screen contentStyle={styles.content} edges={['top']}>
      <StatusBar style="dark" />

      <RecordHeader eyebrow={activity.studyTitle} title={activity.title} />

      <View style={styles.body}>
        <InstructionCard
          instruction={activity.instructions || td('record.noInstructions')}
          warnings={activity.warnings}
        />

        {!permissionChecked ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primaryDark} />
          </View>
        ) : !granted ? (
          <View style={styles.permissionCard}>
            <View style={styles.permissionIcon}>
              <Ionicons name="mic-outline" size={28} color={colors.primaryDark} />
            </View>
            <Text style={styles.permissionTitle}>
              {td('record.microphone.permissionTitle')}
            </Text>
            <Text style={styles.permissionBody}>
              {td('record.microphone.permissionBody')}
            </Text>
            <Button
              label={
                permission?.canAskAgain
                  ? td('record.microphone.openMicrophone')
                  : td('record.camera.openSettings')
              }
              onPress={() => {
                if (permission?.canAskAgain) {
                  void requestRecordingPermissionsAsync()
                    .then(setPermission)
                    .catch(() => setError(td('record.microphone.error')));
                } else {
                  void Linking.openSettings();
                }
              }}
            />
          </View>
        ) : mode === 'text' ? (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>{td('record.text.label')}</Text>
              <TextInput
                accessibilityLabel={td('record.text.label')}
                maxLength={100000}
                multiline
                onChangeText={setAnswer}
                placeholder={td('record.text.placeholder')}
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                textAlignVertical="top"
                value={answer}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setMode('audio')}
              style={({ pressed }) => [
                styles.switchButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="mic-outline" size={18} color={colors.text} />
              <Text style={styles.switchLabel}>{td('record.audio.toAudio')}</Text>
            </Pressable>
          </>
        ) : recording ? (
          <View style={styles.recordedCard}>
            <View style={styles.recordedIcon}>
              <Ionicons name="mic" size={28} color={colors.primaryDark} />
            </View>
            <View style={styles.recordedText}>
              <Text style={styles.recordedTitle}>{td('record.audio.recorded')}</Text>
              <Text style={styles.recordedDuration}>
                {td('record.audio.duration', {
                  duration: formatDuration(recording.durationMs),
                })}
              </Text>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.recorder}>
              {phase === 'recording' || phase === 'stopping' ? (
                <View style={styles.recordingRow}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingLabel}>
                    {td('record.audio.recording')}
                  </Text>
                </View>
              ) : (
                <View style={styles.idleIcon}>
                  <Ionicons name="mic-outline" size={30} color={colors.primaryDark} />
                </View>
              )}

              <View style={styles.timerRow}>
                <Text style={styles.timer}>
                  {formatDuration(
                    phase === 'recording'
                      ? recorderState.durationMillis
                      : 0,
                  )}
                </Text>
                <Text style={styles.timerTotal}>/ 1:00</Text>
              </View>

              <View
                accessibilityLabel={td('record.audio.level')}
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: Math.round(level * 100) }}
                style={styles.wave}
              >
                {METERS.map((meter) => (
                  <View
                    key={meter}
                    style={[
                      styles.bar,
                      {
                        height:
                          phase === 'recording' || phase === 'stopping'
                            ? 8 +
                              level *
                                64 *
                                (0.5 +
                                  0.5 * Math.sin((meter + 1) * 1.7 + level * 4))
                            : 8,
                      },
                      phase === 'recording' || phase === 'stopping'
                        ? styles.barRecorded
                        : styles.barIdle,
                    ]}
                  />
                ))}
              </View>

              <Text style={styles.limit}>{td('record.audio.limit')}</Text>
            </View>

            {canSwitchToText && phase === 'idle' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setMode('text')}
                style={({ pressed }) => [
                  styles.switchButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="text-outline" size={18} color={colors.text} />
                <Text style={styles.switchLabel}>{td('record.audio.toText')}</Text>
              </Pressable>
            ) : null}
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.spacer} />

      <View style={styles.footer}>
        {mode === 'text' ? (
          <Button
            disabled={saving || !answer.trim()}
            label={saving ? td('record.saving') : td('record.save')}
            onPress={() => {
              void saveText();
            }}
          />
        ) : phase === 'recording' || phase === 'stopping' ? (
          <Button
            disabled={phase === 'stopping'}
            icon={<Ionicons name="square" size={16} color={colors.white} />}
            label={td('record.audio.stop')}
            onPress={() => {
              void stopRecording();
            }}
            style={styles.stopButton}
          />
        ) : recording ? (
          <>
            <Button
              disabled={saving}
              label={saving ? td('record.saving') : td('record.save')}
              onPress={() => {
                void saveAudio();
              }}
            />
            <Pressable
              accessibilityRole="button"
              onPress={discard}
              style={({ pressed }) => [styles.discard, pressed && styles.pressed]}
            >
              <Text style={styles.discardLabel}>{td('record.video.discard')}</Text>
            </Pressable>
          </>
        ) : (
          <Button
            disabled={!granted}
            label={td('record.audio.start')}
            onPress={() => {
              void startRecording();
            }}
          />
        )}
        <Text style={styles.offline}>{td('record.offlineNote')}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  body: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textBody,
  },
  recorder: {
    alignItems: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  idleIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
  },
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D92D20',
  },
  recordingLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 14,
    lineHeight: 19,
    color: '#9B1C1C',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  timer: {
    fontFamily: fonts.mono,
    fontSize: 44,
    lineHeight: 48,
    color: colors.text,
  },
  timerTotal: {
    fontFamily: fonts.mono,
    fontSize: 18,
    lineHeight: 24,
    color: colors.textMuted,
  },
  wave: {
    width: '100%',
    height: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 3,
  },
  bar: {
    flex: 1,
    minWidth: 0,
    borderRadius: 3,
  },
  barRecorded: {
    backgroundColor: colors.primary,
  },
  barIdle: {
    backgroundColor: colors.divider,
  },
  limit: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
    color: colors.textMuted,
  },
  recordedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  recordedIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
  },
  recordedText: {
    flex: 1,
    gap: 2,
  },
  recordedTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 17,
    lineHeight: 23,
    color: colors.text,
  },
  recordedDuration: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textMuted,
  },
  permissionCard: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  permissionIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
  },
  permissionTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 19,
    lineHeight: 25,
    textAlign: 'center',
    color: colors.text,
  },
  permissionBody: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: colors.textBody,
  },
  switchButton: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  switchLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  field: {
    gap: 6,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },
  input: {
    minHeight: 330,
    paddingVertical: spacing.md,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#858EA1',
    backgroundColor: colors.surface,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  error: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: '#9B1C1C',
  },
  spacer: {
    flexGrow: 1,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  stopButton: {
    backgroundColor: '#9B1C1C',
  },
  discard: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textMuted,
  },
  offline: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.75,
  },
});
