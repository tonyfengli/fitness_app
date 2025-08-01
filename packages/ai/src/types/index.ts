export * from "./exercise";
export * from "./workoutSession";
export * from "./clientContext";
export * from "./workoutTemplate";
export * from "./filterTypes";
export * from "./testHelpers";
export * from "./groupContext";
export * from "./groupBlueprint";
export * from "./standardBlueprint";

// Union type for any blueprint
import type { GroupWorkoutBlueprint } from "./groupBlueprint";
import type { StandardGroupWorkoutBlueprint } from "./standardBlueprint";

export type AnyGroupWorkoutBlueprint = GroupWorkoutBlueprint | StandardGroupWorkoutBlueprint;