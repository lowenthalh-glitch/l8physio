package mocks

// MockDataStore holds generated IDs for all physio entities
type MockDataStore struct {
	// Phase 1: Clients, Exercises, Protocols, and Therapists (no dependencies)
	PhysioClientIDs    []string
	PhysioExerciseIDs  []string
	PhysioProtocolIDs  []string
	PhysioTherapistIDs []string

	// Phase 2: Treatment Plans (depends on PhysioClientIDs)
	TreatmentPlanIDs []string

	// Phase 3: Appointments (depends on PhysioClientIDs, TreatmentPlanIDs)
	AppointmentIDs []string

	// Phase 4: Progress Logs (depends on PhysioClientIDs, TreatmentPlanIDs, AppointmentIDs)
	ProgressLogIDs []string

}
