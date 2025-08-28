export interface Exercise {
  id: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles: string[] | null;
  loadedJoints: string[] | null;
  movementPattern: string;
  modality: string;
  movementTags: string[] | null;
  functionTags: string[] | null;
  fatigueProfile: string;
  complexityLevel: string;
  equipment: string[] | null;
  strengthLevel: string;
  templateType?: string[];
  createdAt: Date;
}
