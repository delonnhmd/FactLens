// PHASE 3 STEP 14
// Verifact UI redesign

import { useMemo } from 'react';
import { SafeAreaView, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { Header } from '../../components/Header';
import { useScrollAwareTabBar } from '../../context/TabBarVisibilityContext';
import type { AppTheme } from '../../context/DisplaySettingsContext';
import { useAppTheme } from '../../hooks/useTheme';

export default function SearchScreen() {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const { handleScroll } = useScrollAwareTabBar();

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Search" subtitle="Search claims, sources, and topics" />
      <ScrollView
        contentContainerStyle={styles.content}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchBox}>
          <TextInput
            placeholder="Search claims, sources, topics..."
            placeholderTextColor={appTheme.colors.muted}
            style={styles.input}
          />
        </View>

        <Text style={styles.empty}>Search results will appear here.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.card,
  },
  content: {
    padding: 10,
    paddingBottom: 12,
  },
  searchBox: {
    borderWidth: theme.borderWidth,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    backgroundColor: theme.colors.background,
  },
  input: {
    height: 48,
    fontSize: Math.round(14 * (theme.typography.body.fontSize / 16)),
    color: theme.colors.text,
  },
  empty: {
    marginTop: 24,
    color: theme.colors.subtext,
    fontSize: Math.round(14 * (theme.typography.body.fontSize / 16)),
  },
  });
}
