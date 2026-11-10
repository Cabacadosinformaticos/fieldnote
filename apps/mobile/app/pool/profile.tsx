import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { apiErrorMessage } from '@/api/errors';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ChoiceGroup } from '@/components/account/ChoiceGroup';
import { FieldSelect } from '@/components/account/FieldSelect';
import { SelectSheet } from '@/components/account/SelectSheet';
import { accountHref } from '@/components/account/navigation';
import {
  ageLabel,
  ageValue,
  genderLabel,
  genderValue,
  languageLabels,
  languageValues,
  poolAgeLabels,
  poolConcelhos,
  poolFreguesias,
  poolGenderLabels,
  poolLanguageLabels,
  poolSituationLabels,
  poolTransportLabels,
  situationLabel,
  situationValue,
  transportLabel,
  transportValue,
} from '@/components/account/poolOptions';
import { ta } from '@/i18n/ta';
import {
  getPoolCredential,
  getPoolMember,
  joinPool,
  savePoolCredential,
  updatePoolMember,
} from '@/state/actions';
import { colors, fonts, radii, spacing } from '@/theme';

type SheetKind = 'concelho' | 'freguesia';

export default function PoolProfileScreen() {
  const [credential, setCredential] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [concelho, setConcelho] = useState('');
  const [freguesia, setFreguesia] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [situation, setSituation] = useState('');
  const [transport, setTransport] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setReady(false);
      setLoadError(null);

      const stored = await getPoolCredential().catch(() => null);
      if (!active) {
        return;
      }
      if (!stored) {
        setCredential(null);
        setReady(true);
        return;
      }

      // A stored credential means the member already exists: never fall back to joining.
      setCredential(stored);
      const { data, error: apiError } = await getPoolMember(stored);
      if (!active) {
        return;
      }
      if (!data) {
        setLoadError(apiErrorMessage(apiError));
        setReady(true);
        return;
      }

      setConcelho(data.concelho);
      setFreguesia(data.freguesia ?? '');
      setAge(ageLabel(data.age_band));
      setGender(genderLabel(data.gender));
      setSituation(situationLabel(data.occupation));
      setTransport(transportLabel(data.usual_transport));
      setLanguages(languageLabels(data.languages));
      setReady(true);
    };

    void load();

    return () => {
      active = false;
    };
  }, [attempt]);

  const toggleLanguage = (option: string) => {
    setLanguages((current) =>
      current.includes(option)
        ? current.filter((language) => language !== option)
        : [...current, option],
    );
  };

  const save = async () => {
    if (!concelho) {
      setError(ta('account.error'));
      return;
    }

    setBusy(true);
    setError(null);
    const body = {
      concelho,
      freguesia: freguesia || null,
      age_band: ageValue(age),
      gender: genderValue(gender),
      occupation: situationValue(situation),
      usual_transport: transportValue(transport),
      languages: languageValues(languages),
    };
    const result = credential
      ? await updatePoolMember(credential, body)
      : await joinPool(body);
    setBusy(false);

    if (!result.data) {
      setError(apiErrorMessage(result.error));
      return;
    }

    if (
      !credential &&
      'credential' in result.data &&
      typeof result.data.credential === 'string'
    ) {
      await savePoolCredential(result.data.credential);
    }

    router.replace(accountHref('/pool/settings'));
  };

  if (!ready) {
    return (
      <Screen contentStyle={styles.loading}>
        <StatusBar style="dark" />
        <Text style={styles.loadingText}>{ta('account.loading')}</Text>
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen contentStyle={styles.loadErrorContent}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
        </View>
        <View style={styles.loadErrorCard}>
          <Ionicons
            name="alert-circle-outline"
            size={28}
            color={colors.primaryDark}
          />
          <Text style={styles.loadErrorText}>{loadError}</Text>
          <Button
            label={ta('common.retry')}
            onPress={() => setAttempt((value) => value + 1)}
          />
        </View>
      </Screen>
    );
  }

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
          placeholder={ta('poolProfile.choose')}
          required
          value={concelho}
        />

        {freguesiaOptions.length > 0 ? (
          <>
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
          </>
        ) : null}

        <ChoiceGroup
          label={ta('poolProfile.age')}
          onChange={setAge}
          options={poolAgeLabels}
          value={age}
        />
        <ChoiceGroup
          label={ta('poolProfile.gender')}
          onChange={setGender}
          options={poolGenderLabels}
          value={gender}
        />
        <ChoiceGroup
          label={ta('poolProfile.situation')}
          onChange={setSituation}
          options={poolSituationLabels}
          value={situation}
        />
        <ChoiceGroup
          label={ta('poolProfile.transport')}
          onChange={setTransport}
          options={poolTransportLabels}
          value={transport}
        />
        <ChoiceGroup
          hint={ta('poolProfile.languagesHint')}
          label={ta('poolProfile.languages')}
          onChange={toggleLanguage}
          options={poolLanguageLabels}
          value={languages}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          disabled={busy}
          label={busy ? ta('account.busy') : ta('poolProfile.save')}
          onPress={() => {
            void save();
          }}
        />
      </View>

      <SelectSheet
        onClose={() => setSheet(null)}
        onSelect={(option) => {
          setConcelho(option);
          setFreguesia('');
          setSheet(null);
        }}
        options={poolConcelhos}
        searchable
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
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textMuted,
  },
  loadErrorContent: {
    gap: spacing.lg,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  loadErrorCard: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.card,
    padding: spacing.xl,
    backgroundColor: colors.surface,
  },
  loadErrorText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textBody,
  },
  header: {
    paddingTop: spacing.sm,
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
  error: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#9B1C1C',
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
