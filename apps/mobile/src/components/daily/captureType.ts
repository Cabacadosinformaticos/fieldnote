import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import type { CaptureType } from '@/fake/daily';
import type { DailyTranslationKey } from '@/i18n/daily';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export const captureTypeLabelKeys: Record<CaptureType, DailyTranslationKey> = {
  photo: 'type.photo',
  text: 'type.text',
  video: 'type.video',
  audio: 'type.audio',
  scale: 'type.scale',
};

export const captureTypeIcons: Record<CaptureType, IoniconName> = {
  photo: 'camera-outline',
  text: 'text-outline',
  video: 'videocam-outline',
  audio: 'mic-outline',
  scale: 'analytics-outline',
};
