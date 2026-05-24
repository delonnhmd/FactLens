// PHASE 1 STEP 2
import { useState } from "react";
import { View, Text, TextInput, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from "react-native";
import { Header } from "../../components/Header";

export default function CreateScreen() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Create Claim" subtitle="Draft a new news claim" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Claim Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Enter a concise claim title"
            style={styles.input}
            placeholderTextColor="#9CA3AF"
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the claim in a few sentences"
            style={[styles.input, styles.textArea]}
            placeholderTextColor="#9CA3AF"
            multiline
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Source URL</Text>
          <TextInput
            value={sourceUrl}
            onChangeText={setSourceUrl}
            placeholder="Add a source link"
            style={styles.input}
            placeholderTextColor="#9CA3AF"
            keyboardType="url"
          />
        </View>
        <TouchableOpacity style={styles.button} onPress={() => {}} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Submit Claim</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  content: {
    padding: 20,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    marginBottom: 8,
    fontSize: 14,
    color: "#374151",
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#111827",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  button: {
    marginTop: 8,
    backgroundColor: "#2563EB",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
});
