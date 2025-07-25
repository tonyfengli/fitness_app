import type { Equipment } from '../../types';

export function generateEquipmentConstraints(equipment: Equipment): string {
  const sections: string[] = ['## Equipment (resets each round):'];
  
  // Limited equipment
  const limited: string[] = [];
  if (equipment.barbells > 0) limited.push(`${equipment.barbells} barbells`);
  if (equipment.benches > 0) limited.push(`${equipment.benches} benches`);
  if (equipment.cable_machine > 0) limited.push(`${equipment.cable_machine} cable machine`);
  if (equipment.landmine > 0) limited.push(`${equipment.landmine} landmine`);
  if (equipment.row_machine > 0) limited.push(`${equipment.row_machine} row machine`);
  
  sections.push(`- Limited: ${limited.join(', ')}`);
  
  // Available equipment
  const available: string[] = [];
  if (equipment.bands > 0) available.push(`${equipment.bands} bands`);
  if (equipment.kettlebells > 0) available.push(`${equipment.kettlebells} kettlebells`);
  if (equipment.medicine_balls > 0) available.push('medicine balls');
  if (equipment.dumbbells === 'unlimited') available.push('dumbbells (unlimited)');
  
  sections.push(`- Available: ${available.join(', ')}`);
  
  return sections.join('\n');
}