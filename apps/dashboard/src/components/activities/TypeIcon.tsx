import type { ComponentType, SVGProps } from 'react'
import type { CaptureType } from '../../api/activities'
import {
  AudioIcon,
  CameraIcon,
  ScaleIcon,
  TextTypeIcon,
  VideoIcon,
} from './ActivityIcons'

const icons: Record<CaptureType, ComponentType<SVGProps<SVGSVGElement>>> = {
  photo: CameraIcon,
  text: TextTypeIcon,
  video: VideoIcon,
  audio: AudioIcon,
  scale: ScaleIcon,
}

export default function TypeIcon({ type, size = 16 }: { type: CaptureType; size?: number }) {
  const Icon = icons[type]
  return <Icon width={size} height={size} />
}
