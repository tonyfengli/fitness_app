import { calculateMuscleDistribution, formatDistributionOptions } from "./muscleDistributionCalculator";

describe("muscleDistributionCalculator", () => {
  describe("calculateMuscleDistribution", () => {
    // Test 1: Simple balanced case
    it("should generate single option when perfectly balanced", () => {
      const result = calculateMuscleDistribution({
        totalExercises: 4,
        preAssignedMuscles: ["chest"],
        targetMuscles: ["chest", "back"],
      });

      expect(result.options).toHaveLength(1);
      // 3 remaining slots: back gets 2 to balance with chest's 1, chest gets 1 more
      expect(result.options[0]).toEqual({ back: 2, chest: 1 });
    });

    // Test 2: Two options with multiple targets
    it("should generate two options for multiple uncovered muscles", () => {
      const result = calculateMuscleDistribution({
        totalExercises: 5,
        preAssignedMuscles: ["chest"],
        targetMuscles: ["chest", "back", "shoulders"],
      });

      expect(result.options).toHaveLength(2);
      // 4 remaining slots distributed across 3 muscles
      // Option A: balanced (each muscle gets ~1-2)
      expect(result.options[0]).toEqual({ back: 2, shoulders: 1, chest: 1 });
      // Option B: alternative distribution
      expect(result.options[1]).toEqual({ back: 1, shoulders: 2, chest: 1 });
    });

    // Test 3: Core enabled with core as target
    it("should handle core as muscle target separately from pre-assigned core", () => {
      const result = calculateMuscleDistribution({
        totalExercises: 5,
        preAssignedMuscles: ["chest"], // pre-assigned core doesn't count for muscle targets
        targetMuscles: ["chest", "core", "shoulders"],
      });

      expect(result.options).toHaveLength(2);
      // 4 remaining slots: core and shoulders need coverage
      expect(result.options[0]).toEqual({ core: 2, shoulders: 1, chest: 1 });
      expect(result.options[1]).toEqual({ core: 1, shoulders: 2, chest: 1 });
    });

    // Test 4: Too many muscles, too few slots
    it("should handle case where slots < uncovered muscles", () => {
      const result = calculateMuscleDistribution({
        totalExercises: 4,
        preAssignedMuscles: ["chest"],
        targetMuscles: ["chest", "back", "biceps", "triceps"],
      });

      expect(result.options).toHaveLength(1);
      // Can only cover 3 of the 3 uncovered muscles
      expect(result.options[0]).toEqual({ back: 1, biceps: 1, triceps: 1 });
    });

    // Test 5: Edge case - 7 exercises with 2 targets
    it("should allow up to 4 per muscle for edge case", () => {
      const result = calculateMuscleDistribution({
        totalExercises: 7,
        preAssignedMuscles: ["chest", "chest"],
        targetMuscles: ["chest", "back"],
      });

      // With only 2 targets and 5 slots, distribution is deterministic
      expect(result.options).toHaveLength(1);
      // 5 slots to distribute: back needs 3 to balance with chest's 2, chest gets 2 more
      expect(result.options[0]).toEqual({ back: 3, chest: 2 });
    });

    // Test 6: All muscles already covered
    it("should distribute evenly when all muscles covered", () => {
      const result = calculateMuscleDistribution({
        totalExercises: 6,
        preAssignedMuscles: ["chest", "back", "shoulders"],
        targetMuscles: ["chest", "back", "shoulders"],
      });

      expect(result.options).toHaveLength(1);
      // 3 remaining slots distributed evenly
      expect(result.options[0]).toEqual({ chest: 1, back: 1, shoulders: 1 });
    });

    // Test 7: No remaining slots
    it("should return empty distribution when no slots remain", () => {
      const result = calculateMuscleDistribution({
        totalExercises: 3,
        preAssignedMuscles: ["chest", "back", "core"],
        targetMuscles: ["chest", "back"],
      });

      expect(result.options).toHaveLength(1);
      expect(result.options[0]).toEqual({});
    });

    // Test 8: Single muscle target
    it("should give all slots to single muscle target", () => {
      const result = calculateMuscleDistribution({
        totalExercises: 5,
        preAssignedMuscles: ["chest"],
        targetMuscles: ["chest"],
      });

      expect(result.options).toHaveLength(1);
      // With 5 total and 1 pre-assigned, 4 slots remain
      // But max is 4 total (1 pre + 3 new), so chest gets 3 new
      expect(result.options[0]).toEqual({ chest: 3 });
    });
  });

  describe("formatDistributionOptions", () => {
    it("should format single option correctly", () => {
      const formatted = formatDistributionOptions([{ chest: 2, back: 1 }]);
      expect(formatted).toEqual(["Select: 2 chest, 1 back"]);
    });

    it("should format multiple options correctly", () => {
      const formatted = formatDistributionOptions([
        { core: 1, shoulders: 2 },
        { core: 2, shoulders: 1 },
      ]);
      expect(formatted).toEqual([
        "Select: 1 core, 2 shoulders",
        "Select: 2 core, 1 shoulders",
      ]);
    });

    it("should handle empty distribution", () => {
      const formatted = formatDistributionOptions([{}]);
      expect(formatted).toEqual(["Select: "]);
    });
  });
});