import { Ionicons } from '@expo/vector-icons';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
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

const LIMIT_MS = 120_000;

type Phase = 'idle' | 'recording' | 'recorded';

type RecordedVideo = {
  uri: string;
  durationMs: number;
};

function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function VideoRecordScreen() {
  const { activityId, promptId } = useLocalSearchParams<{
    activityId: string;
    promptId?: string;
  }>();
  const { activity, loading } = useCachedActivity(activityId, promptId);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const cameraRef = useRef<CameraView>(null);
  const startedAt = useRef(0);
  const stopRequested = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [video, setVideo] = useState<RecordedVideo | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (phase !== 'recording') {
      return;
    }
    const timer = setInterval(() => {
      setElapsed(Math.min(LIMIT_MS, Date.now() - startedAt.current));
    }, 250);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'recording' || elapsed < LIMIT_MS || stopRequested.current) {
      return;
    }
    stopRequested.current = true;
    cameraRef.current?.stopRecording();
  }, [elapsed, phase]);

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

  if (!activity.captureTypes.includes('video')) {
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

  const cameraGranted = cameraPermission?.granted === true;
  const micGranted = micPermission?.granted === true;
  const permissionsReady =
    cameraPermission !== null && micPermission !== null;
  const needsCamera = permissionsReady && !cameraGranted;
  const needsMic = permissionsReady && !micGranted;
  const canAskAgain =
    (!needsCamera || cameraPermission?.canAskAgain === true) &&
    (!needsMic || micPermission?.canAskAgain === true);

  const requestPermissions = async () => {
    if (!cameraGranted) {
      await requestCameraPermission();
    }
    if (!micGranted) {
      await requestMicPermission();
    }
  };

  const startRecording = async () => {
    if (
      !cameraRef.current ||
      !cameraReady ||
      phase !== 'idle' ||
      !cameraGranted ||
      !micGranted
    ) {
      return;
    }
    setError(null);
    setElapsed(0);
    stopRequested.current = false;
    startedAt.current = Date.now();
    setPhase('recording');

    try {
      const result = await cameraRef.current.recordAsync({ maxDuration: 120 });
      if (!result?.uri) {
        throw new Error('video_missing');
      }
      setVideo({
        uri: result.uri,
        durationMs: Math.min(LIMIT_MS, Date.now() - startedAt.current),
      });
      setPhase('recorded');
    } catch {
      setError(td('record.video.captureError'));
      setPhase('idle');
    }
  };

  const stopRecording = () => {
    if (phase !== 'recording' || stopRequested.current) {
      return;
    }
    stopRequested.current = true;
    cameraRef.current?.stopRecording();
  };

  const discard = () => {
    setVideo(null);
    setElapsed(0);
    setError(null);
    setPhase('idle');
    setCameraReady(false);
  };

  const save = async () => {
    if (!video || saving) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const entryId = await saveEntry({
        activity,
        type: 'video',
        mediaUris: [
          {
            uri: video.uri,
            mimeType: mimeTypeForUri(video.uri, 'video'),
          },
        ],
      });
      router.replace({ pathname: '/record/saved', params: { id: entryId } });
    } catch {
      setError(td('record.saveError'));
      setSaving(false);
    }
  };

  return (
    <Screen contentStyle={styles.content} edges={['top']}>
      <StatusBar style="dark" />

      <RecordHeader eyebrow={activity.studyTitle} title={activity.title} />

      <View style={styles.body}>
        <InstructionCard
          instruction={activity.instructions || td('record.noInstructions')}
          warnings={activity.warnings}
        />

        {video ? (
          <View style={styles.recordedCard}>
            <View style={styles.recordedIcon}>
              <Ionicons name="videocam" size={28} color={colors.primaryDark} />
            </View>
            <View style={styles.recordedText}>
              <Text style={styles.recordedTitle}>{td('record.video.recorded')}</Text>
              <Text style={styles.recordedDuration}>
                {td('record.video.duration', {
                  duration: formatDuration(video.durationMs),
                })}
              </Text>
            </View>
          </View>
        ) : needsCamera || needsMic ? (
          <View style={styles.permissionCard}>
            <View style={styles.permissionIcon}>
              <Ionicons
                name={needsCamera ? 'camera-outline' : 'mic-outline'}
                size={28}
                color={colors.primaryDark}
              />
            </View>
            <Text style={styles.permissionTitle}>
              {needsCamera
                ? td('record.camera.permissionTitle')
                : td('record.microphone.permissionTitle')}
            </Text>
            <Text style={styles.permissionBody}>
              {needsCamera
                ? td('record.camera.permissionBody')
                : td('record.microphone.permissionBody')}
            </Text>
            <Button
              label={
                canAskAgain
                  ? needsCamera
                    ? td('record.camera.openCamera')
                    : td('record.microphone.openMicrophone')
                  : td('record.camera.openSettings')
              }
              onPress={() => {
                if (canAskAgain) {
                  void requestPermissions();
                } else {
                  void Linking.openSettings();
                }
              }}
            />
          </View>
        ) : (
          <View style={styles.preview}>
            {permissionsReady ? (
              <CameraView
                facing="back"
                mode="video"
                onCameraReady={() => setCameraReady(true)}
                onMountError={() => setError(td('record.camera.error'))}
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <ActivityIndicator color={colors.white} />
            )}

            {phase === 'recording' ? (
              <>
                <View style={styles.recordingChip}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingLabel}>
                    {td('record.video.recording')}
                  </Text>
                </View>
                <View style={styles.timerChip}>
                  <Text style={styles.timer}>
                    {formatDuration(elapsed)} / 2:00
                  </Text>
                </View>
              </>
            ) : (
              <Pressable
                accessibilityLabel={td('record.video.start')}
                accessibilityRole="button"
                disabled={!cameraReady || phase !== 'idle'}
                onPress={() => {
                  void startRecording();
                }}
                style={({ pressed }) => [
                  styles.recordButton,
                  (!cameraReady || phase !== 'idle') && styles.recordButtonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="videocam" size={26} color={colors.white} />
              </Pressable>
            )}
          </View>
        )}

        {video ? null : (
          <View style={styles.progressGroup}>
            <View
              accessibilityLabel={td('record.video.limit')}
              accessibilityRole="progressbar"
              accessibilityValue={{
                min: 0,
                max: 120_000,
                now: elapsed,
              }}
              style={styles.progressTrack}
            >
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, (elapsed / LIMIT_MS) * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.limit}>{td('record.video.limit')}</Text>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.spacer} />

      <View style={styles.footer}>
        {phase === 'recording' ? (
          <Button
            icon={<Ionicons name="square" size={16} color={colors.white} />}
            labelSize={17}
            label={td('record.video.stop')}
            onPress={stopRecording}
            style={styles.stopButton}
          />
        ) : video ? (
          <>
            <Button
              disabled={saving}
              labelSize={17}
              label={saving ? td('record.saving') : td('record.save')}
              onPress={() => {
                void save();
              }}
            />
            <Pressable
              accessibilityRole="button"
              onPress={discard}
              style={({ pressed }) => [styles.discard, pressed && styles.pressed]}
            >
              <Text style={styles.discardLabel}>
                {td('record.video.discard')}
              </Text>
            </Pressable>
          </>
        ) : (
          <Button
            disabled={!cameraReady || !cameraGranted || !micGranted}
            label={td('record.video.start')}
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
  message: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textBody,
  },
  preview: {
    position: 'relative',
    height: 380,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radii.card,
    backgroundColor: colors.text,
  },
  recordingChip: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF5A4F',
  },
  recordingLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.white,
  },
  timerChip: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  timer: {
    fontFamily: fonts.mono,
    fontSize: 14,
    lineHeight: 20,
    color: colors.white,
  },
  recordButton: {
    position: 'absolute',
    bottom: spacing.xl,
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 36,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    backgroundColor: '#C4362C',
  },
  recordButtonDisabled: {
    opacity: 0.5,
  },
  progressGroup: {
    gap: 6,
  },
  progressTrack: {
    height: spacing.sm,
    overflow: 'hidden',
    borderRadius: spacing.xs,
    backgroundColor: colors.divider,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#9B1C1C',
  },
  limit: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
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
    gap: spacing.xs,
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
