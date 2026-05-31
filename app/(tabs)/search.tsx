// PHASE 3 STEP 14
// FactLens UI redesign

import { SafeAreaView, Text, TextInput, View, StyleSheet } from 'react-native';
import { Header } from '../../components/Header';
import { theme } from '../../constants/theme';

export default function SearchScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Header title="Search" subtitle="Search claims, sources, and topics" />
      <View style={styles.content}>
        <View style={styles.searchBox}>
          <TextInput
            placeholder="Search claims, sources, topics..."
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
          />
        </View>

        <Text style={styles.empty}>Search results will appear here.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.card,
  },
  content: {
    padding: 10,
  },
  searchBox: {
    borderWidth: 0.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    backgroundColor: theme.colors.background,
  },
  input: {
    height: 48,
    fontSize: 14,
    color: theme.colors.text,
  },
  empty: {
    marginTop: 24,
    color: theme.colors.subtext,
    fontSize: 14,
  },
});
