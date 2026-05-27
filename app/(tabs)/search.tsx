// PHASE 3 STEP 14
// Search screen placeholder

import { SafeAreaView, Text, TextInput, View, StyleSheet } from 'react-native';

export default function SearchScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Search</Text>
      <Text style={styles.subtitle}>Search claims, sources, and topics.</Text>

      <View style={styles.searchBox}>
        <TextInput
          placeholder="Search claims, sources, topics..."
          placeholderTextColor="#9CA3AF"
          style={styles.input}
        />
      </View>

      <Text style={styles.empty}>Search results will appear here.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#6B7280',
  },
  searchBox: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: '#F9FAFB',
  },
  input: {
    height: 48,
    fontSize: 16,
    color: '#111827',
  },
  empty: {
    marginTop: 24,
    color: '#6B7280',
    fontSize: 15,
  },
});
