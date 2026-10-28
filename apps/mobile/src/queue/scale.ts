import type { ScaleConfig, ScaleShown } from './types';

export type ScaleOption = {
  value: number;
  label: string;
};

function clampedPoints(points: number | null): number {
  if (points === null || !Number.isFinite(points)) {
    return 7;
  }
  return Math.min(11, Math.max(2, Math.trunc(points)));
}

export function scaleOptions(scale: ScaleConfig): ScaleOption[] {
  const points = clampedPoints(scale.points);
  const lowest = scale.type === 'numbers' && points === 11 ? 0 : 1;

  return Array.from({ length: points }, (_, index) => {
    const value = lowest + index;
    const isFirst = index === 0;
    const isLast = index === points - 1;
    const isMiddle = points % 2 === 1 && index === (points - 1) / 2;

    return {
      value,
      label: isFirst
        ? (scale.startLabel ?? '')
        : isLast
          ? (scale.endLabel ?? '')
          : isMiddle
            ? (scale.middleLabel ?? '')
            : '',
    };
  });
}

export function faceLabels(scale: ScaleConfig): string[] {
  const options = scaleOptions(scale);
  const points = options.length;

  if (points === 3) {
    return [
      scale.startLabel ?? '',
      scale.middleLabel ?? '',
      scale.endLabel ?? '',
    ];
  }
  if (points === 5) {
    return [
      scale.startLabel ?? '',
      '',
      scale.middleLabel ?? '',
      '',
      scale.endLabel ?? '',
    ];
  }

  return options.map((option, index) => {
    if (index === 0) {
      return scale.startLabel ?? '';
    }
    if (index === points - 1) {
      return scale.endLabel ?? '';
    }
    if (points % 2 === 1 && index === (points - 1) / 2) {
      return scale.middleLabel ?? '';
    }
    return '';
  });
}

export function faceLevel(index: number, points: number): number {
  if (points <= 1) {
    return 2;
  }
  return Math.round((index / (points - 1)) * 4);
}

export function scaleShownFor(
  scale: ScaleConfig,
  labels: string[],
): ScaleShown {
  const shown: ScaleShown = {
    scale_type: scale.type,
  };
  if (scale.type !== 'slider') {
    shown.points = clampedPoints(scale.points);
  }

  if (scale.startLabel) {
    shown.start_label = scale.startLabel;
  }
  if (scale.middleLabel) {
    shown.middle_label = scale.middleLabel;
  }
  if (scale.endLabel) {
    shown.end_label = scale.endLabel;
  }
  if (scale.type === 'faces') {
    shown.labels = labels;
  }

  return shown;
}

export function scaleMaximum(scale: ScaleShown | null): number {
  if (!scale) {
    return 0;
  }
  if (scale.scale_type === 'slider') {
    return 100;
  }
  if (scale.scale_type === 'numbers' && scale.points === 11) {
    return 10;
  }
  return scale.points ?? 0;
}
