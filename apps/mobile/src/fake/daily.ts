import type { DailyTranslationKey } from '@/i18n/daily';

export type CaptureType = 'text' | 'photo' | 'video' | 'audio' | 'scale';
export type ScaleKind = 'numbers' | 'faces';
export type WarningId = 'privacy' | 'locationOn' | 'locationOff';
export type EntryStatus = 'sent' | 'waiting' | 'failed';
export type EntryGroupId = 'attention' | 'today' | 'yesterday' | 'oct7' | 'oct6';

export type ScaleConfig = {
  kind: ScaleKind;
  points: number;
  lowKey: DailyTranslationKey;
  highKey: DailyTranslationKey;
  midKey?: DailyTranslationKey;
};

export type DailyActivity = {
  id: string;
  titleKey: DailyTranslationKey;
  instructionKey: DailyTranslationKey;
  contextKey: DailyTranslationKey;
  captureTypes: CaptureType[];
  warnings: WarningId[];
  expectedMinutes: number;
  closesAt: string;
  scale?: ScaleConfig;
};

export type DailyEntry = {
  id: string;
  activityId: string;
  titleKey: DailyTranslationKey;
  type: CaptureType;
  status: EntryStatus;
  group: EntryGroupId;
  recordedTime: string;
  recordedDate?: string;
  receivedTime?: string;
  scaleValue?: number;
  scaleMax?: number;
  contentKey?: DailyTranslationKey;
  hasLocation?: boolean;
  failureKey?: DailyTranslationKey;
};

export type EntryGroup = {
  id: EntryGroupId;
  labelKey: DailyTranslationKey;
  entries: DailyEntry[];
};

export const dailyStudy = {
  name: 'Viver o Jardim da Estrela',
  day: 4,
  totalDays: 14,
} as const;

export const dailyActivities: DailyActivity[] = [
  {
    id: 'moment',
    titleKey: 'activity.moment.title',
    instructionKey: 'activity.moment.instruction',
    contextKey: 'record.context.free',
    captureTypes: ['photo', 'text', 'video'],
    warnings: ['privacy', 'locationOn'],
    expectedMinutes: 2,
    closesAt: '20:00',
  },
  {
    id: 'brought',
    titleKey: 'activity.brought.title',
    instructionKey: 'activity.brought.instruction',
    contextKey: 'record.context.request',
    captureTypes: ['audio', 'text'],
    warnings: ['locationOff'],
    expectedMinutes: 1,
    closesAt: '20:00',
  },
  {
    id: 'mood',
    titleKey: 'activity.mood.title',
    instructionKey: 'activity.mood.instruction',
    contextKey: 'record.context.quick',
    captureTypes: ['scale'],
    warnings: [],
    expectedMinutes: 1,
    closesAt: '23:59',
    scale: {
      kind: 'numbers',
      points: 7,
      lowKey: 'scale.low',
      highKey: 'scale.high',
    },
  },
  {
    id: 'mood-faces',
    titleKey: 'activity.moodFaces.title',
    instructionKey: 'activity.moodFaces.instruction',
    contextKey: 'record.context.quick',
    captureTypes: ['scale'],
    warnings: [],
    expectedMinutes: 1,
    closesAt: '23:59',
    scale: {
      kind: 'faces',
      points: 5,
      lowKey: 'scale.face.veryBad',
      highKey: 'scale.face.veryGood',
    },
  },
];

export type DailyTodayRequest = {
  activityId: string;
  askedAt: string;
};

export type DailyToday = {
  request: DailyTodayRequest | null;
  freeEntry: { used: number; cap: number };
  nextRequest: { from: string; to: string };
  otherStudyRequests: number;
};

export const dailyToday: DailyToday = {
  request: {
    activityId: 'brought',
    askedAt: '14:15',
  },
  freeEntry: {
    used: 2,
    cap: 2,
  },
  nextRequest: {
    from: '18:00',
    to: '20:00',
  },
  otherStudyRequests: 1,
};

const momentPhoto: DailyEntry = {
  id: 'e1',
  activityId: 'moment',
  titleKey: 'activity.moment.title',
  type: 'photo',
  status: 'waiting',
  group: 'today',
  recordedTime: '14:26',
  contentKey: 'entry.value.momentPhoto',
  hasLocation: true,
};

const momentText: DailyEntry = {
  id: 'e2',
  activityId: 'moment',
  titleKey: 'activity.moment.title',
  type: 'text',
  status: 'waiting',
  group: 'today',
  recordedTime: '14:09',
  contentKey: 'entry.value.momentText',
};

const sentPhoto: DailyEntry = {
  id: 'e3',
  activityId: 'moment',
  titleKey: 'activity.moment.title',
  type: 'photo',
  status: 'sent',
  group: 'today',
  recordedTime: '12:05',
  receivedTime: '12:06',
  contentKey: 'entry.value.momentPhoto',
  hasLocation: true,
};

const sentText: DailyEntry = {
  id: 'e4',
  activityId: 'moment',
  titleKey: 'activity.moment.title',
  type: 'text',
  status: 'sent',
  group: 'today',
  recordedTime: '09:47',
  receivedTime: '09:48',
  contentKey: 'entry.value.momentText',
};

const failedText: DailyEntry = {
  id: 'e5',
  activityId: 'moment',
  titleKey: 'activity.moment.title',
  type: 'text',
  status: 'failed',
  group: 'attention',
  recordedTime: '11:20',
  recordedDate: '7 out.',
  contentKey: 'entry.value.momentText',
  failureKey: 'entries.failed',
};

const yesterdayScale: DailyEntry = {
  id: 'e6',
  activityId: 'mood',
  titleKey: 'activity.mood.title',
  type: 'scale',
  status: 'sent',
  group: 'yesterday',
  recordedTime: '21:38',
  receivedTime: '21:38',
  scaleValue: 6,
  scaleMax: 7,
};

const yesterdayAudio: DailyEntry = {
  id: 'e7',
  activityId: 'brought',
  titleKey: 'activity.brought.title',
  type: 'audio',
  status: 'sent',
  group: 'yesterday',
  recordedTime: '18:52',
  receivedTime: '18:53',
  contentKey: 'entry.value.broughtAudio',
};

const yesterdayPhoto: DailyEntry = {
  id: 'e8',
  activityId: 'moment',
  titleKey: 'activity.moment.title',
  type: 'photo',
  status: 'sent',
  group: 'yesterday',
  recordedTime: '13:02',
  receivedTime: '13:03',
  contentKey: 'entry.value.momentPhoto',
  hasLocation: true,
};

const yesterdayMorningPhoto: DailyEntry = {
  id: 'e9',
  activityId: 'moment',
  titleKey: 'activity.moment.title',
  type: 'photo',
  status: 'sent',
  group: 'yesterday',
  recordedTime: '10:15',
  receivedTime: '10:16',
  contentKey: 'entry.value.momentPhoto',
  hasLocation: true,
};

const oct7Scale: DailyEntry = {
  id: 'e10',
  activityId: 'mood-faces',
  titleKey: 'activity.moodFaces.title',
  type: 'scale',
  status: 'sent',
  group: 'oct7',
  recordedTime: '21:20',
  receivedTime: '21:21',
  scaleValue: 5,
  scaleMax: 5,
};

const oct7Audio: DailyEntry = {
  id: 'e11',
  activityId: 'brought',
  titleKey: 'activity.brought.title',
  type: 'audio',
  status: 'sent',
  group: 'oct7',
  recordedTime: '19:05',
  receivedTime: '19:06',
  contentKey: 'entry.value.broughtAudio',
};

const oct7Photo: DailyEntry = {
  id: 'e12',
  activityId: 'moment',
  titleKey: 'activity.moment.title',
  type: 'photo',
  status: 'sent',
  group: 'oct7',
  recordedTime: '13:12',
  receivedTime: '13:13',
  contentKey: 'entry.value.momentPhoto',
  hasLocation: true,
};

const oct6Scale: DailyEntry = {
  id: 'e13',
  activityId: 'mood',
  titleKey: 'activity.mood.title',
  type: 'scale',
  status: 'sent',
  group: 'oct6',
  recordedTime: '20:55',
  receivedTime: '20:56',
  scaleValue: 4,
  scaleMax: 7,
};

const oct6Photo: DailyEntry = {
  id: 'e14',
  activityId: 'moment',
  titleKey: 'activity.moment.title',
  type: 'photo',
  status: 'sent',
  group: 'oct6',
  recordedTime: '13:40',
  receivedTime: '13:41',
  contentKey: 'entry.value.momentPhoto',
  hasLocation: true,
};

export const dailyEntryGroups: EntryGroup[] = [
  { id: 'attention', labelKey: 'entries.group.attention', entries: [failedText] },
  {
    id: 'today',
    labelKey: 'entries.group.today',
    entries: [momentPhoto, momentText, sentPhoto, sentText],
  },
  {
    id: 'yesterday',
    labelKey: 'entries.group.yesterday',
    entries: [yesterdayScale, yesterdayAudio, yesterdayPhoto, yesterdayMorningPhoto],
  },
  {
    id: 'oct7',
    labelKey: 'entries.group.oct7',
    entries: [oct7Scale, oct7Audio, oct7Photo],
  },
  { id: 'oct6', labelKey: 'entries.group.oct6', entries: [oct6Scale, oct6Photo] },
];

export const dailyEntries: DailyEntry[] = dailyEntryGroups.flatMap((group) => group.entries);

export const dailyWaitingCount = dailyEntries.filter(
  (entry) => entry.status === 'waiting',
).length;

export const dailyLocation = 'Jardim da Estrela, Lisboa';

export function getActivity(activityId: string | undefined): DailyActivity | undefined {
  return dailyActivities.find((activity) => activity.id === activityId);
}

export function getEntry(entryId: string | undefined): DailyEntry | undefined {
  return dailyEntries.find((entry) => entry.id === entryId);
}
