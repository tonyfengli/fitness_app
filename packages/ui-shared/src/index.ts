// Shared components used by both desktop and mobile
export * from "./components/ExerciseItem";
export * from "./components/Avatar";
export * from "./components/SearchInput";
export * from "./components/Card";
export * from "./components/WorkoutCard";
export * from "./components/Button";
export * from "./components/DropdownMenu";
export * from "./components/Form";
export * from "./components/Input";
export * from "./components/Label";
export * from "./components/Theme";
export * from "./components/Toast";
export * from "./components/Icon";
export * from "./components/icons";
export * from "./components/lists";
export * from "./components/modals";
export * from "./components/UserAvatar";
export * from "./components/OnlineStatusBadge";
export * from "./components/FeedbackSection";

// Design System
export * from "./styles";

// Utilities
export { cn } from "./utils/cn";
export * from "./utils/exercise-filters";
export * from "./utils/round-helpers";
export { 
  // Export all except Exercise interface to avoid conflict with context
  type StationExercise,
  type StationPosition,
  type StationInfo,
  getStationInfo,
  isStationExercise,
  getExercisesAtStation,
  getNextStationIndex,
  flattenStationExercises,
  nestStationExercises
} from "./utils/station-helpers";
export * from "./utils/workout-actions";

// Constants
export * from "./constants";

// Responsive utilities
export * from "./utils/responsive";

// Responsive components
export * from "./components/ResponsiveView";

// Types
export * from "./types";
export * from "./types/circuit.types";

// Feature flags
export * from "./utils/featureFlags";

// State management
export * from "./context";

// Mock data
export * from "./mocks";

// Hooks
export * from "./hooks";