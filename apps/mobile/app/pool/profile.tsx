import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ChoiceGroup } from '@/components/account/ChoiceGroup';
import { FieldSelect } from '@/components/account/FieldSelect';
import { SelectSheet } from '@/components/account/SelectSheet';
import { accountHref } from '@/components/account/navigation';
import {
  poolAgeGroups,
  poolConcelhos,
  poolFreguesias,
  poolGenders,
  poolLanguages,
  poolProfileDefaults,
  poolSituations,
  poolTransports,
} from '@/fake/account';
import { ta } from '@/i18n/ta';
import { colors, fonts, spacing } from '@/theme';

type SheetKind = 'concelho' | 'freguesia';

export default function PoolProfileScreen() {
  const [concelho, setConcelho] = useState<string>(poolProfileDefaults.concelho);
  const [freguesia, setFreguesia] = useState<string>(
    poolProfileDefaults.freguesia,
  );
  const [age, setAge] = useState<string>(poolProfileDefaults.age);
  const [gender, setGender] = useState('');
  const [situation, setSituation] = useState<string>(
    poolProfileDefaults.situation,
  );
  const [transport, setTransport] = useState<string>(
    poolProfileDefaults.transport,
  );
  const [languages, setLanguages] = useState<string[]>([
    ...poolProfileDefaults.languages,
  ]);
  const [sheet, setSheet] = useState<SheetKind | null>(null);

  const toggleLanguage = (option: string) => {
    setLanguages((current) =>
      current.includes(option)
        ? current.filter((language) => language !== option)
        : [...current, option],
    );
  };

  const freguesiaOptions = poolFreguesias[concelho] ?? [];

  return (
    <Screen scroll={false}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <Text style={styles.title}>{ta('poolProfile.title')}</Text>
          <Text style={styles.body}>{ta('poolProfile.body')}</Text>
        </View>

        <FieldSelect
          hint={ta('poolProfile.concelhoHint')}
          label={ta('poolProfile.concelho')}
          onPress={() => setSheet('concelho')}
          required
          value={concelho}
        />

        <FieldSelect
          label={ta('poolProfile.freguesia')}
          onPress={() => setSheet('freguesia')}
          optional
          placeholder={ta('poolProfile.choose')}
          value={freguesia}
        />
        <View style={styles.preferNotRow}>
          <Pressable
            accessibilityLabel={ta('poolProfile.preferNot')}
            accessibilityRole="button"
            accessibilityState={{ selected: freguesia === '' }}
            onPress={() => setFreguesia('')}
            style={({ pressed }) => [
              styles.preferNot,
              freguesia === '' && styles.preferNotOn,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.preferNotLabel,
                freguesia === '' && styles.preferNotLabelOn,
              ]}
            >
              {ta('poolProfile.preferNot')}
            </Text>
          </Pressable>
        </View>

        <ChoiceGroup
          label={ta('poolProfile.age')}
          onChange={setAge}
          options={poolAgeGroups}
          value={age}
        />
        <ChoiceGroup
          label={ta('poolProfile.gender')}
          onChange={setGender}
          options={poolGenders}
          value={gender}
        />
        <ChoiceGroup
          label={ta('poolProfile.situation')}
          onChange={setSituation}
          options={poolSituations}
          value={situation}
        />
        <ChoiceGroup
          label={ta('poolProfile.transport')}
          onChange={setTransport}
          options={poolTransports}
          value={transport}
        />
        <ChoiceGroup
          hint={ta('poolProfile.languagesHint')}
          label={ta('poolProfile.languages')}
          onChange={toggleLanguage}
          options={poolLanguages}
          value={languages}
        />
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={ta('poolProfile.save')}
          onPress={() => router.replace(accountHref('/pool/settings'))}
        />
      </View>

      <SelectSheet
        hint={ta('poolProfile.concelhoSheetHint')}
        onClose={() => setSheet(null)}
        onSelect={(option) => {
          setConcelho(option);
          setFreguesia('');
          setSheet(null);
        }}
        options={poolConcelhos}
        selected={concelho}
        title={ta('poolProfile.concelho')}
        visible={sheet === 'concelho'}
      />

      <SelectSheet
        hint={ta('poolProfile.freguesiaSheetHint', { concelho })}
        onClose={() => setSheet(null)}
        onSelect={(option) => {
          setFreguesia(option);
          setSheet(null);
        }}
        options={freguesiaOptions}
        selected={freguesia}
        title={ta('poolProfile.freguesia')}
        visible={sheet === 'freguesia'}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  scrollContent: {
    gap: 22,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  intro: {
    gap: 10,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.56,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textBody,
  },
  preferNotRow: {
    flexDirection: 'row',
    marginTop: -10,
  },
  preferNot: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
  },
  preferNotOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  preferNotLabel: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  preferNotLabelOn: {
    color: colors.white,
  },
  pressed: {
    opacity: 0.8,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 14,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.surface,
  },
});
