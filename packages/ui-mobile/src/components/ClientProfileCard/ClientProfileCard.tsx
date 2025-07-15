import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import type { ClientProfileCardProps } from "./ClientProfileCard.types";

export function ClientProfileCard({
  name,
  program,
  avatar,
  avatarFallback,
}: ClientProfileCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarFallbackText}>
              {avatarFallback || name.charAt(0)}
            </Text>
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.program}>{program}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#DBEAFE", // blue-50
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 24,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
  },
  avatarFallback: {
    backgroundColor: "#93C5FD", // blue-300
    justifyContent: "center",
    alignItems: "center",
  },
  avatarFallbackText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827", // gray-900
    marginBottom: 2,
  },
  program: {
    fontSize: 14,
    color: "#4B5563", // gray-600
  },
});