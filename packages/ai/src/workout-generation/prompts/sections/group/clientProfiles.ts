import type { ClientContext } from '../../../../types';

export function generateClientProfiles(clients: ClientContext[]): string {
  const sections: string[] = ['## Clients:'];
  
  clients.forEach(client => {
    const parts: string[] = [`- ${client.name}:`];
    
    // Capacity levels
    parts.push(`${client.strength_capacity} strength/${client.skill_capacity} skill`);
    
    // Total sets target
    if (client.default_sets) {
      parts.push(`${client.default_sets} sets`);
    }
    
    // Goals and intensity
    if (client.primary_goal) {
      parts.push(`goal: ${client.primary_goal}`);
    }
    if (client.intensity) {
      parts.push(`intensity: ${client.intensity}`);
    }
    
    sections.push(parts.join(', '));
    
    // Preferences
    const prefs: string[] = [];
    if (client.muscle_target && client.muscle_target.length > 0) {
      prefs.push(`  - Target: ${client.muscle_target.join(', ')}`);
    }
    if (client.muscle_lessen && client.muscle_lessen.length > 0) {
      prefs.push(`  - Lessen: ${client.muscle_lessen.join(', ')}`);
    }
    if (client.exercise_requests?.include && client.exercise_requests.include.length > 0) {
      prefs.push(`  - Include: ${client.exercise_requests.include.join(', ')}`);
    }
    if (client.exercise_requests?.avoid && client.exercise_requests.avoid.length > 0) {
      prefs.push(`  - Avoid: ${client.exercise_requests.avoid.join(', ')}`);
    }
    if (client.avoid_joints && client.avoid_joints.length > 0) {
      prefs.push(`  - Avoid joints: ${client.avoid_joints.join(', ')}`);
    }
    
    if (prefs.length > 0) {
      sections.push(...prefs);
    }
  });
  
  return sections.join('\n');
}