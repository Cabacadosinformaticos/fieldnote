import type { ComponentType, SVGProps } from 'react'
import type { ActivityTypeId } from '../../fake/activities'
import {
  AudioIcon,
  CameraIcon,
  ScaleIcon,
  TextTypeIcon,
  VideoIcon,
} from './ActivityIcons'

const icons: Record<ActivityTypeId, ComponentType<SVGProps<SVGSVGElement>>> = {
  photo: CameraIcon,
  text: TextTypeIcon,
  video: VideoIcon,
  audio: AudioIcon,
  scale: ScaleIcon,
}

export default function TypeIcon({ type, size = 16 }: { type: ActivityTypeId; size?: number }) {
  const Icon = icons[type]
  return <Icon width={size} height={size} />
}
