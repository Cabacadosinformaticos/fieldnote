import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n/pt';
import { useJoinSession } from '@/state/join';
import { colors, fonts, radii, spacing, typography } from '@/theme';

const CODE_LENGTH = 12;
const MAX_INPUT_LENGTH = 14;

function formatCode(value: string): string {
  const characters = value
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase()
    .slice(0, CODE_LENGTH);

  return characters.replace(/(.{4})/g, '$1-').replace(/-$/, '');
}

export default function CodeScreen() {
  const [code, setCode] = useState('');
  const { startJoin } = useJoinSession();
  const isComplete = code.replace(/-/g, '').length === CODE_LENGTH;

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
      </View>

      <View style={styles.intro}>
        <Text style={typography.title}>{t('code.title')}</Text>
        <Text style={[typography.body, styles.bodyText]}>{t('code.body')}</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t('code.label')}</Text>
        <TextInput
          accessibilityLabel={t('code.label')}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect={false}
          maxLength={MAX_INPUT_LENGTH}
          onChangeText={(value) => setCode(formatCode(value))}
          placeholder={t('code.placeholder')}
          placeholderTextColor={colors.textMuted}
          spellCheck={false}
          style={styles.input}
          value={code}
        />
        <Text style={styles.help}>{t('code.help')}</Text>
      </View>

      <Button
        disabled={!isComplete}
        label={t('common.continue')}
        onPress={() => {
          startJoin(code.replace(/-/g, ''));
          router.push('/join/invitation');
        }}
      />

      <Card style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
        <Text style={styles.infoText}>{t('code.info')}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.xxl,
  },
  header: {
    height: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  intro: {
    gap: 10,
  },
  bodyText: {
    color: colors.textBody,
  },
  field: {
    gap: 10,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },
  input: {
    height: 60,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    fontFamily: fonts.mono,
    fontSize: 22,
    letterSpacing: 2.2,
    color: colors.text,
  },
  help: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radii.xxl,
    padding: spacing.lg,
  },
  infoText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
});
