package mocks

// MockDataStore holds generated IDs for all physio entities.
// PhysioClient IDs are NOT stored here — clients are sourced from the Boostapp
// sync and fetched back from the service when needed (see fetchClientIDs).
type MockDataStore struct {
	// Phase 1: Exercises and Therapists (no dependencies)
	PhysioExerciseIDs        []string
	PhysioExerciseCategories map[string]int32  // exerciseId -> category (1=Mobility,2=Rehab,3=Strength,4=Functional)
	PhysioExerciseIDByName   map[string]string // lowercased exercise name -> exerciseId (last write wins on duplicate names)
	PhysioTherapistIDs       []string

	// Phase 2: Treatment Plans (depends on Boostapp clients + PhysioExerciseIDs)
	TreatmentPlanIDs []string

	// Phase 3: Appointments (depends on Boostapp clients + TreatmentPlanIDs)
	AppointmentIDs []string

	// Phase 4: Progress Logs (depends on Boostapp clients + TreatmentPlanIDs + AppointmentIDs)
	ProgressLogIDs []string
}
