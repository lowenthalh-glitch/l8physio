// Package fixtures creates test entities through the real physio services.
// The services generate the entity ids, so every Create* returns the stored entity.
package fixtures

import (
	"fmt"
	"testing"
	"time"

	"github.com/lowenthalh-glitch/l8physio/go/physio/appointments"
	"github.com/lowenthalh-glitch/l8physio/go/physio/clients"
	"github.com/lowenthalh-glitch/l8physio/go/physio/exercises"
	"github.com/lowenthalh-glitch/l8physio/go/physio/plans"
	"github.com/lowenthalh-glitch/l8physio/go/physio/progress"
	"github.com/lowenthalh-glitch/l8physio/go/physio/protocols"
	"github.com/lowenthalh-glitch/l8physio/go/physio/therapists"
	"github.com/lowenthalh-glitch/l8physio/go/types/physio"
	l8c "github.com/saichler/l8common/go/common"
	ifs "github.com/saichler/l8types/go/ifs"
)

// post creates entity through the service and returns the stored entity. If the
// service answers with something other than T, the posted entity is returned
// (the service callback sets the generated id on it).
func post[T any](t *testing.T, name string, area byte, entity T, vnic ifs.IVNic) T {
	t.Helper()
	res, err := l8c.PostEntity(name, area, entity, vnic)
	if err != nil {
		t.Fatalf("create %s failed: %v", name, err)
	}
	if created, ok := res.(T); ok {
		return created
	}
	return entity
}

func unique(prefix string) string {
	return fmt.Sprintf("%s.%d", prefix, time.Now().UnixNano())
}

// CreateTestClient creates a client.
func CreateTestClient(t *testing.T, vnic ifs.IVNic) *physio.PhysioClient {
	t.Helper()
	return post(t, clients.ServiceName, clients.ServiceArea, &physio.PhysioClient{
		FirstName:        "John",
		LastName:         "Doe",
		Email:            unique("john.doe") + "@test.com",
		Phone:            "+15551234567",
		DateOfBirth:      time.Date(1990, 1, 1, 0, 0, 0, 0, time.UTC).Unix(),
		Status:           physio.PhysioClientStatus_PHYSIO_CLIENT_STATUS_ACTIVE,
		TherapistId:      "therapist-1",
		MedicalHistory:   "Test client for E2E",
		EmergencyContact: "Jane Doe +15557654321",
	}, vnic)
}

// CreateTestTherapist creates a therapist.
func CreateTestTherapist(t *testing.T, vnic ifs.IVNic) *physio.PhysioTherapist {
	t.Helper()
	return post(t, therapists.ServiceName, therapists.ServiceArea, &physio.PhysioTherapist{
		FirstName:      "Jane",
		LastName:       "Smith",
		Email:          unique("jane.smith") + "@test.com",
		Phone:          "+15559876543",
		Specialization: "Orthopedics",
		IsActive:       true,
	}, vnic)
}

// CreateTestExercise creates an exercise.
func CreateTestExercise(t *testing.T, vnic ifs.IVNic) *physio.PhysioExercise {
	t.Helper()
	return post(t, exercises.ServiceName, exercises.ServiceArea, &physio.PhysioExercise{
		Name:         unique("Test Exercise"),
		Description:  "A test exercise for E2E testing",
		Category:     physio.PhysioExerciseCategory_PHYSIO_EXERCISE_CATEGORY_MOBILITY,
		Instructions: "Perform 3 sets of 10 reps",
		DefaultSets:  3,
		DefaultReps:  10,
		IsActive:     true,
	}, vnic)
}

// CreateTestProtocol creates a protocol.
func CreateTestProtocol(t *testing.T, vnic ifs.IVNic) *physio.PhysioProtocol {
	t.Helper()
	return post(t, protocols.ServiceName, protocols.ServiceArea, &physio.PhysioProtocol{
		Name:        unique("Test Protocol"),
		Description: "A test protocol for E2E testing",
		IsActive:    true,
	}, vnic)
}

// CreateTestPlan creates an active treatment plan for the client.
func CreateTestPlan(t *testing.T, vnic ifs.IVNic, clientID, userID string) *physio.TreatmentPlan {
	t.Helper()
	return post(t, plans.ServiceName, plans.ServiceArea, &physio.TreatmentPlan{
		ClientId:  clientID,
		UserId:    userID,
		Title:     unique("Test Plan"),
		Status:    physio.PhysioPlanStatus_PHYSIO_PLAN_STATUS_ACTIVE,
		StartDate: time.Now().Unix(),
		EndDate:   time.Now().Add(30 * 24 * time.Hour).Unix(),
	}, vnic)
}

// CreateTestAppointment creates an appointment tomorrow, one hour long.
func CreateTestAppointment(t *testing.T, vnic ifs.IVNic, clientID, therapistID, userID string) *physio.Appointment {
	t.Helper()
	start := time.Now().Add(24 * time.Hour)
	return post(t, appointments.ServiceName, appointments.ServiceArea, &physio.Appointment{
		ClientId:       clientID,
		TherapistId:    therapistID,
		UserId:         userID,
		StartTime:      start.Unix(),
		EndTime:        start.Add(time.Hour).Unix(),
		Status:         physio.PhysioApptStatus_PHYSIO_APPT_STATUS_SCHEDULED,
		TherapistNotes: "Initial evaluation",
	}, vnic)
}

// CreateTestProgressLog creates a progress log with one completed exercise entry.
func CreateTestProgressLog(t *testing.T, vnic ifs.IVNic, clientID, planID, userID, exerciseID string) *physio.ProgressLog {
	t.Helper()
	return post(t, progress.ServiceName, progress.ServiceArea, &physio.ProgressLog{
		ClientId:         clientID,
		PlanId:           planID,
		UserId:           userID,
		LogDate:          time.Now().Unix(),
		OverallPainLevel: 2,
		GeneralNotes:     "Good progress",
		Entries: []*physio.ProgressEntry{{
			ExerciseId: exerciseID,
			Completed:  true,
			SetsDone:   3,
			RepsDone:   10,
			PainLevel:  2,
		}},
	}, vnic)
}
