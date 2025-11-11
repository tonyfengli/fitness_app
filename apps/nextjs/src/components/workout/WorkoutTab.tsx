"use client";

import React from "react";

interface WorkoutTabProps {
  children: React.ReactNode;
}

export function WorkoutTab({ children }: WorkoutTabProps) {
  return (
    <div className="h-full w-full">
      {children}
    </div>
  );
}