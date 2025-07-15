import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { WorkoutSummaryCardProps } from "./WorkoutSummaryCard.types";

export function WorkoutSummaryCard({
  title,
  date,
  exercises,
  onEdit,
  onAddExercise,
  feedbackSection,
}: WorkoutSummaryCardProps) {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
          {date && <Text style={styles.date}>{date}</Text>}
        </View>
        {onEdit && (
          <TouchableOpacity onPress={onEdit} style={styles.editButton}>
            <MaterialIcons name="edit" size={16} color="#4F46E5" />
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Exercises */}
      <View style={styles.exerciseList}>
        {exercises.map((exercise) => (
          <TouchableOpacity
            key={exercise.id}
            style={styles.exerciseItem}
            onPress={() => exercise.onPress?.()}
          >
            <View style={styles.exerciseIcon}>
              <MaterialIcons name="fitness-center" size={24} color="#4B5563" />
            </View>
            <View style={styles.exerciseInfo}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              <Text style={styles.exerciseSets}>{exercise.sets} sets</Text>
            </View>
            <TouchableOpacity
              onPress={() => exercise.onPlay?.()}
              style={styles.playButton}
            >
              <MaterialIcons name="play-circle-outline" size={24} color="#6B7280" />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </View>

      {/* Add Exercise Button */}
      {onAddExercise && (
        <TouchableOpacity onPress={onAddExercise} style={styles.addButton}>
          <MaterialIcons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add Exercise</Text>
        </TouchableOpacity>
      )}

      {/* Feedback Section */}
      {feedbackSection && (
        <View style={styles.feedbackContainer}>
          {feedbackSection}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    marginBottom: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  date: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  editText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4F46E5",
    marginLeft: 4,
  },
  exerciseList: {
    paddingHorizontal: 16,
  },
  exerciseItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  exerciseIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1F2937",
  },
  exerciseSets: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
  playButton: {
    padding: 8,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#374151",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 8,
  },
  feedbackContainer: {
    marginTop: 16,
  },
});