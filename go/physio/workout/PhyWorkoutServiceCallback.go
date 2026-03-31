package workout

import (
	"math/rand"

	erpc "github.com/saichler/l8erp/go/erp/common"
	"github.com/saichler/l8physio/go/physio/exercises"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

func newPhyWorkoutServiceCallback() ifs.IServiceCallback {
	return erpc.NewServiceCallback[physio.GeneratedWorkout](
		"GeneratedWorkout",
		setWorkoutID,
		nil,
		buildWorkoutOnPost,
	)
}

func setWorkoutID(entity *physio.GeneratedWorkout) {
	erpc.GenerateID(&entity.WorkoutId)
}

// buildWorkoutOnPost is an action validator that runs on POST to auto-populate circuits.
func buildWorkoutOnPost(entity *physio.GeneratedWorkout, action ifs.Action, vnic ifs.IVNic) error {
	if action != ifs.POST {
		return nil
	}
	// Fetch all exercises matching joint + posture + phase
	filter := &physio.PhysioExercise{
		Joint:   entity.Joint,
		Posture: entity.Posture,
		Phase:   entity.Phase,
	}
	all, err := erpc.GetEntities(exercises.ServiceName, exercises.ServiceArea, filter, vnic)
	if err != nil || len(all) == 0 {
		// Try without posture filter — fall back to joint + phase only
		filter2 := &physio.PhysioExercise{
			Joint: entity.Joint,
			Phase: entity.Phase,
		}
		all, err = erpc.GetEntities(exercises.ServiceName, exercises.ServiceArea, filter2, vnic)
		if err != nil {
			return err
		}
	}

	// Group exercises by category
	byCategory := make(map[physio.PhysioExerciseCategory][]*physio.PhysioExercise)
	for _, ex := range all {
		if !ex.IsActive {
			continue
		}
		byCategory[ex.Category] = append(byCategory[ex.Category], ex)
	}

	volume := int(entity.Volume)
	if volume <= 0 {
		volume = 3
	}

	// Build a circuit for each relevant category
	categories := []physio.PhysioExerciseCategory{
		physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_MOBILITY,
		physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_REHAB,
		physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_STRENGTH,
		physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_FUNCTIONAL,
	}

	var circuits []*physio.WorkoutCircuit
	for _, cat := range categories {
		pool, ok := byCategory[cat]
		if !ok || len(pool) == 0 {
			continue
		}
		circuit := buildCircuit(cat, pool, volume)
		if len(circuit.Exercises) > 0 {
			circuits = append(circuits, circuit)
		}
	}

	entity.Circuits = circuits
	return nil
}

// buildCircuit selects up to 2 Fixed exercises + volume Variable exercises from the pool.
func buildCircuit(cat physio.PhysioExerciseCategory, pool []*physio.PhysioExercise, volume int) *physio.WorkoutCircuit {
	circuit := &physio.WorkoutCircuit{Category: cat}

	var fixed []*physio.PhysioExercise
	var variable []*physio.PhysioExercise
	for _, ex := range pool {
		if ex.ExerciseType == physio.PhysioExerciseType_PHYSIO_EXERCISE_TYPE_FIXED {
			fixed = append(fixed, ex)
		} else {
			variable = append(variable, ex)
		}
	}

	// Shuffle variable pool for variety
	rand.Shuffle(len(variable), func(i, j int) { variable[i], variable[j] = variable[j], variable[i] })

	// Select up to 2 fixed + volume variable
	selected := make([]*physio.PhysioExercise, 0, 2+volume)
	if len(fixed) > 2 {
		fixed = fixed[:2]
	}
	selected = append(selected, fixed...)
	for i := 0; i < volume && i < len(variable); i++ {
		selected = append(selected, variable[i])
	}

	for _, ex := range selected {
		reps := ex.DefaultRepsDisplay
		if reps == "" {
			reps = "10-12"
		}
		circuit.Exercises = append(circuit.Exercises, &physio.WorkoutCircuitExercise{
			ExerciseId: ex.ExerciseId,
			Name:       ex.Name,
			Sets:       int32(ex.DefaultSets),
			Reps:       reps,
			LoadType:   ex.LoadType,
			Effort:     ex.Effort,
			LoadNotes:  ex.LoadNotes,
			IsFixed:    ex.ExerciseType == physio.PhysioExerciseType_PHYSIO_EXERCISE_TYPE_FIXED,
		})
	}
	return circuit
}
