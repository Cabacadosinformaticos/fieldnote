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

type ConsentTextProps = {
  study: Study | null | undefined;
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

      <View style={styles.section}>
        <Text style={styles.heading}>{tj('consent.requests.title')}</Text>
        <Text style={styles.paragraph}>
          {`${formatRequestsPerDay(
            study.requests_per_day,
            study.expected_minutes_per_day,
          )}.`}
        </Text>
        <Text style={styles.paragraph}>
          {tj('consent.fallback.recorded', {
            types: formatEntryTypes(study.entry_types, false),
          })}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>{tj('consent.location.title')}</Text>
        <Text style={styles.paragraph}>
          {study.captures_location
            ? tj('consent.fallback.locationYes')
            : tj('consent.fallback.locationNo')}
        </Text>
      </View>

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
