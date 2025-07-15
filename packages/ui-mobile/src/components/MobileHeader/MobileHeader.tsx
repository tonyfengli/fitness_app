import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { MobileHeaderProps } from "./MobileHeader.types";

export function MobileHeader({
  title,
  showNotifications = true,
  hasUnreadNotifications = false,
  onNotificationPress,
  leftAction,
  rightAction,
}: MobileHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Left Section */}
        <View style={styles.leftSection}>
          {leftAction ? (
            <TouchableOpacity onPress={leftAction.onPress} style={styles.iconButton}>
              <MaterialIcons name={leftAction.icon as any} size={24} color="#4B5563" />
            </TouchableOpacity>
          ) : (
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{title}</Text>
            </View>
          )}
        </View>

        {/* Right Section */}
        <View style={styles.rightSection}>
          {rightAction && (
            <TouchableOpacity onPress={rightAction.onPress} style={styles.iconButton}>
              <MaterialIcons name={rightAction.icon as any} size={24} color="#4B5563" />
            </TouchableOpacity>
          )}
          {showNotifications && (
            <TouchableOpacity onPress={onNotificationPress} style={styles.notificationButton}>
              <MaterialIcons name="notifications" size={24} color="#4B5563" />
              {hasUnreadNotifications && <View style={styles.notificationDot} />}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  content: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  leftSection: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
  },
  iconButton: {
    padding: 8,
  },
  notificationButton: {
    padding: 8,
    position: "relative",
  },
  notificationDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
});