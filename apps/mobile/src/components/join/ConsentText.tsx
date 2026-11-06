import { StyleSheet, Text, View } from 'react-native';

import type { components } from '@/api/schema';
import { tj } from '@/i18n/tj';
import { colors, fonts } from '@/theme';

import {
  formatEntryTypes,
  formatPeriod,
  formatRequestsPerDay,
  formatTeam,
} from './format';

type Study = components['schemas']['StudyCardOut'];

/**
 * The join flow has the whole study card; a cached participation only keeps the text and the
 * facts stored on the phone, so the sections without data are left out.
 */
type ConsentStudy = Pick<Study, 'title' | 'description' | 'consent_text' | 'team'> &
  Partial<
    Pick<
      Study,
      | 'starts_on'
      | 'ends_on'
      | 'requests_per_day'
      | 'expected_minutes_per_day'
      | 'entry_types'
      | 'captures_location'
    >
  >;

type ConsentTextProps = {
  study: ConsentStudy | null | undefined;
};

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

/**
 * The consent text of the study being joined (FR-03). When the study has none, the mockup's
 * sections are kept but show only facts from the API response: no sample study or team.
 */
export function ConsentText({ study }: ConsentTextProps) {
  if (!study) {
    return null;
  }

  const stored = study.consent_text?.trim();

  if (stored) {
    return (
      <View style={styles.container}>
        {paragraphs(stored).map((paragraph, index) => (
          <Text key={index} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}
        <Text style={styles.closing}>{tj('consent.closing')}</Text>
      </View>
    );
  }

  const requestsPerDay = study.requests_per_day;
  const expectedMinutes = study.expected_minutes_per_day;
  const entryTypes = study.entry_types;
  const capturesLocation = study.captures_location;
  const hasRequests =
    requestsPerDay !== undefined || entryTypes !== undefined;

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.heading}>{tj('consent.objective.title')}</Text>
        <Text style={styles.paragraph}>
          {study.description ?? tj('consent.fallback.aboutBody', { title: study.title })}
        </Text>
        <Text style={styles.paragraph}>
          {tj('consent.fallback.period', {
            period: formatPeriod(study.starts_on, study.ends_on),
          })}
        </Text>
      </View>

      {hasRequests ? (
        <View style={styles.section}>
          <Text style={styles.heading}>{tj('consent.requests.title')}</Text>
          {requestsPerDay !== undefined && expectedMinutes !== undefined ? (
            <Text style={styles.paragraph}>
              {`${formatRequestsPerDay(requestsPerDay, expectedMinutes)}.`}
            </Text>
          ) : null}
          {entryTypes !== undefined ? (
            <Text style={styles.paragraph}>
              {tj('consent.fallback.recorded', {
                types: formatEntryTypes(entryTypes, false),
              })}
            </Text>
          ) : null}
        </View>
      ) : null}

      {capturesLocation !== undefined ? (
        <View style={styles.section}>
          <Text style={styles.heading}>{tj('consent.location.title')}</Text>
          <Text style={styles.paragraph}>
            {capturesLocation
              ? tj('consent.fallback.locationYes')
              : tj('consent.fallback.locationNo')}
          </Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.heading}>{tj('consent.contact.title')}</Text>
        <Text style={styles.paragraph}>
          {tj('consent.fallback.team', { team: formatTeam(study.team) })}
        </Text>
      </View>

      <Text style={styles.closing}>{tj('consent.closing')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 22,
  },
  section: {
    gap: 10,
  },
  heading: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.09,
    color: colors.text,
  },
  paragraph: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  closing: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
});
