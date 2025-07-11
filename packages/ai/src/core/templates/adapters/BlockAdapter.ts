/**
 * BlockAdapter - Converts between legacy and dynamic block formats
 * Ensures backward compatibility during the migration
 */

import type { OrganizedExercises } from "../types";
import type { DynamicOrganizedExercises, WorkoutTemplate } from "../types/dynamicBlockTypes";
import { getDefaultWorkoutTemplate } from "../config/defaultTemplates";
import { logBlock, logBlockTransformation } from "../../../utils/blockDebugger";

export class BlockAdapter {
  /**
   * Convert dynamic blocks to legacy format
   * Maps dynamic block IDs to hardcoded blockA, blockB, etc.
   */
  static toLegacyFormat(dynamic: DynamicOrganizedExercises): OrganizedExercises {
    logBlock('BlockAdapter.toLegacyFormat - Start', {
      blockIds: Object.keys(dynamic.blocks),
      templateId: dynamic.metadata.template.id
    });

    const legacy: OrganizedExercises = {
      blockA: dynamic.blocks.A || [],
      blockB: dynamic.blocks.B || [],
      blockC: dynamic.blocks.C || [],
      blockD: dynamic.blocks.D || []
    };

    logBlockTransformation('BlockAdapter.toLegacyFormat',
      {
        dynamicBlocks: Object.keys(dynamic.blocks).length,
        totalExercises: dynamic.metadata.totalExercises
      },
      {
        blockA: legacy.blockA.length,
        blockB: legacy.blockB.length,
        blockC: legacy.blockC.length,
        blockD: legacy.blockD.length
      }
    );

    return legacy;
  }

  /**
   * Convert legacy format to dynamic blocks
   * Creates dynamic structure from hardcoded blocks
   */
  static toDynamicFormat(
    legacy: OrganizedExercises, 
    template?: WorkoutTemplate
  ): DynamicOrganizedExercises {
    logBlock('BlockAdapter.toDynamicFormat - Start', {
      hasTemplate: !!template,
      legacyBlockCounts: {
        blockA: legacy.blockA.length,
        blockB: legacy.blockB.length,
        blockC: legacy.blockC.length,
        blockD: legacy.blockD.length
      }
    });

    // Use provided template or get default
    const workoutTemplate = template || getDefaultWorkoutTemplate();

    const dynamic: DynamicOrganizedExercises = {
      blocks: {
        'A': legacy.blockA,
        'B': legacy.blockB,
        'C': legacy.blockC,
        'D': legacy.blockD
      },
      metadata: {
        template: workoutTemplate,
        timestamp: new Date().toISOString(),
        totalExercises: 
          legacy.blockA.length + 
          legacy.blockB.length + 
          legacy.blockC.length + 
          legacy.blockD.length
      }
    };

    logBlockTransformation('BlockAdapter.toDynamicFormat',
      {
        blockA: legacy.blockA.length,
        blockB: legacy.blockB.length,
        blockC: legacy.blockC.length,
        blockD: legacy.blockD.length
      },
      {
        dynamicBlocks: Object.keys(dynamic.blocks).length,
        templateId: dynamic.metadata.template.id,
        totalExercises: dynamic.metadata.totalExercises
      }
    );

    return dynamic;
  }

  /**
   * Check if a structure is in legacy format
   */
  static isLegacyFormat(data: any): data is OrganizedExercises {
    return (
      data &&
      typeof data === 'object' &&
      'blockA' in data &&
      'blockB' in data &&
      'blockC' in data &&
      'blockD' in data &&
      Array.isArray(data.blockA) &&
      Array.isArray(data.blockB) &&
      Array.isArray(data.blockC) &&
      Array.isArray(data.blockD)
    );
  }

  /**
   * Check if a structure is in dynamic format
   */
  static isDynamicFormat(data: any): data is DynamicOrganizedExercises {
    return (
      data &&
      typeof data === 'object' &&
      'blocks' in data &&
      'metadata' in data &&
      typeof data.blocks === 'object' &&
      data.metadata?.template
    );
  }

  /**
   * Smart conversion - detects format and converts if needed
   */
  static ensureDynamicFormat(data: any): DynamicOrganizedExercises | null {
    if (this.isDynamicFormat(data)) {
      return data;
    }
    
    if (this.isLegacyFormat(data)) {
      return this.toDynamicFormat(data);
    }

    logBlock('BlockAdapter.ensureDynamicFormat - Invalid Format', {
      dataKeys: Object.keys(data || {}),
      error: 'Unrecognized format'
    });

    return null;
  }

  /**
   * Smart conversion - detects format and converts if needed
   */
  static ensureLegacyFormat(data: any): OrganizedExercises | null {
    if (this.isLegacyFormat(data)) {
      return data;
    }
    
    if (this.isDynamicFormat(data)) {
      return this.toLegacyFormat(data);
    }

    logBlock('BlockAdapter.ensureLegacyFormat - Invalid Format', {
      dataKeys: Object.keys(data || {}),
      error: 'Unrecognized format'
    });

    return null;
  }
}