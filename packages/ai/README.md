# AI Package - LangGraph Integration

This package contains a simple LangGraph example to help you understand how to integrate AI workflows into your fitness app.

## Quick Start

Run the example:
```bash
pnpm -F @acme/ai example
```

## What's Included

**Simple Workout Graph** (`simple-workout-graph.ts`) - Single-node example for generating workout plans

## Key Concepts

### State Management
LangGraph uses a state object that flows between nodes:
```typescript
interface WorkoutState {
  userInput: string;
  workoutPlan: string;
}
```

### Nodes
Functions that process and transform state:
```typescript
async function generateWorkout(state: WorkoutState): Promise<Partial<WorkoutState>> {
  // Process state and return updates
  return { workoutPlan: "..." };
}
```

### Graph Construction
```typescript
const workflow = new StateGraph<WorkoutState>({ channels: {...} });
workflow.addNode("workout", generateWorkout);
workflow.setEntryPoint("workout");
workflow.addEdge("workout", END);
const app = workflow.compile();
```

## Using with ChatGPT

To use the real ChatGPT integration:
1. Set your `OPENAI_API_KEY` environment variable
2. Use `createSimpleWorkoutGraph()` instead of the mock version
3. The graph will call OpenAI's API to generate real workout plans

## Next Steps

- Add more sophisticated state management
- Create multi-node workflows (analysis → planning → validation)
- Integrate with your existing tRPC API
- Add persistent storage for workout plans