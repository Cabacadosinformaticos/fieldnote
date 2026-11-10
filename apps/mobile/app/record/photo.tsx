import { Ionicons } from '@expo/vector-icons';
import {
  CameraView,
  useCameraPermissions,
  type CameraCapturedPicture,
} from 'expo-camera';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
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
import { CaptureTypeTabs } from '@/components/daily/CaptureTypeTabs';
import { InstructionCard } from '@/components/daily/InstructionCard';
import { RecordHeader } from '@/components/daily/RecordHeader';
import { clockOf } from '@/components/daily/entryFormat';
import { td } from '@/i18n/td';
import { useCachedActivity } from '@/queue/hooks';
import { mimeTypeForUri, saveEntry } from '@/queue/save';
import { colors, fonts, radii, spacing } from '@/theme';

type Captured = {
  uri: string;
  capturedAt: string;
};

export default function PhotoRecordScreen() {
  const { activityId, promptId } = useLocalSearchParams<{
    activityId: string;
    promptId?: string;
  }>();
  const { activity, loading } = useCachedActivity(activityId, promptId);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [photo, setPhoto] = useState<Captured | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (!activity.captureTypes.includes('photo')) {
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

  const takePhoto = async () => {
    if (!cameraRef.current || !cameraReady || capturing) {
      return;
    }
    setCapturing(true);
    setError(null);
    try {
      const result: CameraCapturedPicture | undefined =
        await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!result?.uri) {
        throw new Error('photo_missing');
      }
      setPhoto({ uri: result.uri, capturedAt: new Date().toISOString() });
      setCameraReady(false);
    } catch {
      setError(td('record.photo.captureError'));
    } finally {
      setCapturing(false);
    }
  };

  const save = async () => {
    if (!photo || saving) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const entryId = await saveEntry({
        activity,
        type: 'photo',
        body: note,
        mediaUris: [
          {
            uri: photo.uri,
            mimeType: mimeTypeForUri(photo.uri, 'photo'),
          },
        ],
      });
      router.replace({ pathname: '/record/saved', params: { id: entryId } });
    } catch {
      setError(td('record.saveError'));
      setSaving(false);
    }
  };

  const showPermissionPrompt = permission !== null && !permission.granted;

  return (
    <Screen contentStyle={styles.content} edges={['top']}>
      <StatusBar style="dark" />

      <RecordHeader eyebrow={activity.studyTitle} title={activity.title} />

      <View style={styles.body}>
        <InstructionCard
          instruction={activity.instructions || td('record.noInstructions')}
          warnings={activity.warnings}
        />

        <CaptureTypeTabs
          active="photo"
          activityId={activity.id}
          promptId={activity.promptId}
          types={activity.captureTypes}
        />

        {photo ? (
          <View style={styles.preview}>
            <Image
              accessibilityLabel={td('entry.photoLabel')}
              contentFit="cover"
              source={{ uri: photo.uri }}
              style={styles.photo}
            />
            <View style={styles.capturedBadge}>
              <Ionicons name="time-outline" size={14} color={colors.white} />
              <Text style={styles.capturedBadgeText}>
                {td('record.photo.capturedAt', {
                  time: clockOf(photo.capturedAt),
                })}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setPhoto(null);
                setError(null);
              }}
              style={({ pressed }) => [styles.retake, pressed && styles.pressed]}
            >
              <Ionicons name="refresh" size={16} color={colors.text} />
              <Text style={styles.retakeLabel}>{td('record.photo.retake')}</Text>
            </Pressable>
          </View>
        ) : showPermissionPrompt ? (
          <View style={styles.permissionCard}>
            <View style={styles.permissionIcon}>
              <Ionicons
                name="camera-outline"
                size={28}
                color={colors.primaryDark}
              />
            </View>
            <Text style={styles.permissionTitle}>
              {td('record.camera.permissionTitle')}
            </Text>
            <Text style={styles.permissionBody}>
              {td('record.camera.permissionBody')}
            </Text>
            <Button
              label={
                permission.canAskAgain
                  ? td('record.camera.openCamera')
                  : td('record.camera.openSettings')
              }
              onPress={() => {
                if (permission.canAskAgain) {
                  void requestPermission();
                } else {
                  void Linking.openSettings();
                }
              }}
            />
          </View>
        ) : (
          <View style={styles.camera}>
            {permission === null ? (
              <ActivityIndicator color={colors.primaryDark} />
            ) : (
              <CameraView
                facing="back"
                onCameraReady={() => setCameraReady(true)}
                onMountError={() => setError(td('record.camera.error'))}
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
              />
            )}
            <Pressable
              accessibilityLabel={td('record.photo.shutter')}
              accessibilityRole="button"
              disabled={!cameraReady || capturing}
              onPress={() => {
                void takePhoto();
              }}
              style={({ pressed }) => [
                styles.shutter,
                (!cameraReady || capturing) && styles.shutterDisabled,
                pressed && styles.pressed,
              ]}
            >
              {capturing ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Ionicons name="camera" size={28} color={colors.text} />
              )}
            </Pressable>
          </View>
        )}

        {photo ? (
          <View style={styles.field}>
            <Text style={styles.label}>
              {td('record.photo.noteLabel')}{' '}
              <Text style={styles.optional}>
                {td('record.photo.noteOptional')}
              </Text>
            </Text>
            <TextInput
              accessibilityLabel={td('record.photo.noteLabel')}
              maxLength={100000}
              multiline
              onChangeText={setNote}
              placeholder={td('record.photo.notePlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              textAlignVertical="top"
              value={note}
            />
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.spacer} />

      <View style={styles.footer}>
        <Button
          disabled={!photo || saving}
          labelSize={17}
          label={saving ? td('record.saving') : td('record.save')}
          onPress={() => {
            void save();
          }}
        />
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
  },
  photo: {
    width: '100%',
    height: 280,
    borderRadius: radii.card,
    backgroundColor: colors.scanBackground,
  },
  capturedBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(27, 36, 54, 0.78)',
  },
  capturedBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.white,
  },
  retake: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  retakeLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },
  camera: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radii.card,
    backgroundColor: colors.scanBackground,
  },
  shutter: {
    position: 'absolute',
    bottom: spacing.lg,
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: colors.surface,
  },
  shutterDisabled: {
    opacity: 0.6,
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
  field: {
    gap: 6,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },
  optional: {
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  input: {
    minHeight: 80,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#858EA1',
    backgroundColor: colors.surface,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
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
