import { StyleSheet, Text, View } from 'react-native';

import type { JoinKey } from '@/i18n/join';
import { tj } from '@/i18n/tj';
import { colors, fonts, radii, spacing } from '@/theme';

type Block = {
  key: JoinKey;
  bullet?: boolean;
};

type Section = {
  title: JoinKey;
  blocks: Block[];
};

const SECTIONS: Section[] = [
  {
    title: 'consent.objective.title',
    blocks: [
      { key: 'consent.objective.p1' },
      { key: 'consent.objective.p2' },
    ],
  },
  {
    title: 'consent.requests.title',
    blocks: [
      { key: 'consent.requests.p1' },
      { key: 'consent.requests.p2' },
    ],
  },
  {
    title: 'consent.data.title',
    blocks: [
      { key: 'consent.data.b1', bullet: true },
      { key: 'consent.data.b2', bullet: true },
      { key: 'consent.data.b3', bullet: true },
      { key: 'consent.data.b4', bullet: true },
      { key: 'consent.data.b5', bullet: true },
    ],
  },
  {
    title: 'consent.viewers.title',
    blocks: [
      { key: 'consent.viewers.p1' },
      { key: 'consent.viewers.p2' },
      { key: 'consent.viewers.p3' },
      { key: 'consent.viewers.p4' },
    ],
  },
  {
    title: 'consent.location.title',
    blocks: [
      { key: 'consent.location.p1' },
      { key: 'consent.location.p2' },
    ],
  },
  {
    title: 'consent.care.title',
    blocks: [
      { key: 'consent.care.p1' },
      { key: 'consent.care.b1', bullet: true },
      { key: 'consent.care.b2', bullet: true },
      { key: 'consent.care.b3', bullet: true },
    ],
  },
  {
    title: 'consent.rights.title',
    blocks: [
      { key: 'consent.rights.p1' },
      { key: 'consent.rights.p2' },
      { key: 'consent.rights.p3' },
      { key: 'consent.rights.p4' },
      { key: 'consent.rights.p5' },
    ],
  },
];

export function ConsentText() {
  return (
    <View style={styles.container}>
      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.heading}>{tj(section.title)}</Text>
          {section.blocks.map((block) =>
            block.bullet ? (
              <View key={block.key} style={styles.bulletRow}>
                <View style={styles.bullet} />
                <Text style={styles.bulletText}>{tj(block.key)}</Text>
              </View>
            ) : (
              <Text key={block.key} style={styles.paragraph}>
                {tj(block.key)}
              </Text>
            ),
          )}
        </View>
      ))}

      <View style={styles.section}>
        <Text style={styles.heading}>{tj('consent.contact.title')}</Text>
        <Text style={styles.paragraph}>{tj('consent.contact.body')}</Text>
        <View style={styles.contact}>
          <Text style={styles.contactName}>{tj('consent.contact.name')}</Text>
          <Text style={styles.contactRole}>{tj('consent.contact.role')}</Text>
          <Text style={styles.contactEmail}>{tj('consent.contact.email')}</Text>
        </View>
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
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  bullet: {
    width: 6,
    height: 6,
    marginTop: 10,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  bulletText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  contact: {
    gap: 2,
    borderRadius: radii.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
  },
  contactName: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  contactRole: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  contactEmail: {
    marginTop: 4,
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.primaryDark,
  },
  closing: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
});
