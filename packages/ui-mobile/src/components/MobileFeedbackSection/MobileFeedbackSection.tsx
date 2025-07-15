import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { MobileFeedbackSectionProps } from "./MobileFeedbackSection.types";

export function MobileFeedbackSection({
  isExpanded = false,
  onToggle,
  feedbackText = "Client feedback will be displayed here.",
}: MobileFeedbackSectionProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onToggle} style={styles.header}>
        <Text style={styles.headerText}>View Client Feedback</Text>
        <MaterialIcons 
          name={isExpanded ? "expand-less" : "expand-more"} 
          size={24} 
          color="#6B7280" 
        />
      </TouchableOpacity>
      
      {isExpanded && (
        <View style={styles.content}>
          <Text style={styles.feedbackText}>{feedbackText}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 16,
    marginTop: 16,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 8,
  },
  headerText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#374151",
  },
  content: {
    backgroundColor: "#F9FAFB",
    borderRadius: 6,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  feedbackText: {
    fontSize: 14,
    color: "#6B7280",
  },
});