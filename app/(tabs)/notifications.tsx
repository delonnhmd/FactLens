// PHASE 1 STEP 2
import { StyleSheet, SafeAreaView } from "react-native";
import { Header } from "../../components/Header";
import { EmptyState } from "../../components/EmptyState";

export default function NotificationsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Header title="Notifications" subtitle="Activity and updates" />
      <EmptyState message="No notifications yet." />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
});
