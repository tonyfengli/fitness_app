// Debug script to check station creation in a circuit workout
// This will help identify the "Target station not found" error

const { PrismaClient } = require('@prisma/client');

async function debugStations() {
  const prisma = new PrismaClient();
  
  try {
    // Get the most recent circuit session
    const sessions = await prisma.trainingSession.findMany({
      where: {
        templateType: 'circuit',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1,
    });

    if (sessions.length === 0) {
      console.log('No circuit sessions found');
      return;
    }

    const session = sessions[0];
    console.log('Session ID:', session.id);
    console.log('Template Config:', JSON.stringify(session.templateConfig, null, 2));

    // Get workouts for this session
    const workouts = await prisma.workout.findMany({
      where: {
        trainingSessionId: session.id,
      },
    });

    console.log('\nWorkouts found:', workouts.length);
    
    for (const workout of workouts) {
      console.log(`\n--- Workout ${workout.id} (User: ${workout.userId}) ---`);
      
      // Get exercises for this workout
      const exercises = await prisma.workoutExercise.findMany({
        where: {
          workoutId: workout.id,
        },
        orderBy: [
          { groupName: 'asc' },
          { orderIndex: 'asc' },
          { stationIndex: 'asc' },
        ],
      });

      // Group by round
      const exercisesByRound = exercises.reduce((acc, ex) => {
        const round = ex.groupName || 'No Round';
        if (!acc[round]) acc[round] = [];
        acc[round].push(ex);
        return acc;
      }, {});

      for (const [roundName, roundExercises] of Object.entries(exercisesByRound)) {
        console.log(`\n  ${roundName}:`);
        
        // Group by orderIndex (stations)
        const exercisesByStation = roundExercises.reduce((acc, ex) => {
          const station = ex.orderIndex;
          if (!acc[station]) acc[station] = [];
          acc[station].push(ex);
          return acc;
        }, {});

        const stationNumbers = Object.keys(exercisesByStation).map(Number).sort((a, b) => a - b);
        console.log(`    Stations (orderIndex): [${stationNumbers.join(', ')}]`);
        
        stationNumbers.forEach((stationOrderIndex, stationDisplayIndex) => {
          const stationExercises = exercisesByStation[stationOrderIndex];
          console.log(`    Station ${stationDisplayIndex} (orderIndex=${stationOrderIndex}):`);
          
          stationExercises.forEach(ex => {
            console.log(`      - ID: ${ex.id.slice(-8)} | exerciseId: ${ex.exerciseId?.slice(-8) || 'custom'} | stationIndex: ${ex.stationIndex}`);
          });
        });
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugStations();