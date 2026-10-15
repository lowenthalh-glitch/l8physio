package fixtures

import (
	"fmt"
	"testing"
	"time"

	"github.com/saichler/l8common/go/common"
	ifs "github.com/saichler/l8types/go/ifs"
	"github.com/lowenthalh-glitch/l8physio/go/types/physio"
)

// CreateTestClient creates a test client entity
func CreateTestClient(t *testing.T, vnic ifs.IVNic) *physio.PhysioClient {
	t.Helper()
	
	client := &physio.PhysioClient{
		FirstName:       "John",
		LastName:        "Doe",
		Email:           fmt.Sprintf("john.doe.%d@test.com", time.Now().UnixNano()),
		TherapistId:     "therapist-1",
		Status:          physio.PhysioClientStatus_PHYSIO_CLIENT_STATUS_ACTIVE,
		DateOfBirth:     "1990-01-01",
		Phone:           "+15551234567",
		AddressLine1:    "123 Main St",
		City:            "Los Angeles",
		StateProvince:   "CA",
		PostalCode:      "90001",
		CountryCode:     "US",
		Notes:           "Test client for E2E",
		InsuranceCarrier: "Aetna",
		PolicyNumber:    "ABC123456",
	}
	
	_, err := l8c.PostEntity("clients", 50, client, vnic)
	if err != nil {
		t.Fatalf("Failed to create test client: %v", err)
	}
	
	return client
}

// CreateTestTherapist creates a test therapist entity
func CreateTestTherapist(t *testing.T, vnic ifs.IVNic) *physio.PhysioTherapist {
	t.Helper()
	
	therapist := &physio.PhysioTherapist{
		FirstName: "Jane",
		LastName:  "Smith",
		Email:     fmt.Sprintf("jane.smith.%d@test.com", time.Now().UnixNano()),
		Specialty: "Orthopedics",
		Phone:     "+15559876543",
		Active:    true,
	}
	
	_, err := l8c.PostEntity("therapists", 51, therapist, vnic)
	if err != nil {
		t.Fatalf("Failed to create test therapist: %v", err)
	}
	
	return therapist
}

// CreateTestExercise creates a test exercise entity
func CreateTestExercise(t *testing.T, vnic ifs.IVNic) *physio.PhysioExercise {
	t.Helper()
	
	exercise := &physio.PhysioExercise{
		Name:        "Test Exercise",
		Description: "A test exercise for E2E testing",
		Category:    1,
		Equipment:   2,
		Instructions: "Perform 3 sets of 10 reps",
	}
	
	_, err := l8c.PostEntity("exercises", 52, exercise, vnic)
	if err != nil {
		t.Fatalf("Failed to create test exercise: %v", err)
	}
	
	return exercise
}

// CreateTestProtocol creates a test protocol entity
func CreateTestProtocol(t *testing.T, vnic ifs.IVNic) *physio.PhysioProtocol {
	t.Helper()
	
	protocol := &physio.PhysioProtocol{
		Name:        "Test Protocol",
		Description: "A test protocol for E2E testing",
	}
	
	_, err := l8c.PostEntity("protocols", 53, protocol, vnic)
	if err != nil {
		t.Fatalf("Failed to create test protocol: %v", err)
	}
	
	return protocol
}

// CreateTestAppointment creates a test appointment entity
func CreateTestAppointment(t *testing.T, vnic ifs.IVNic, clientID, therapistID string) *physio.Appointment {
	t.Helper()
	
	appointment := &physio.Appointment{
		ClientId:       clientID,
		TherapistId:    therapistID,
		ApptDate:       time.Now().Add(24 * time.Hour).Format("2006-01-02"),
		StartTime:      "09:00",
		EndTime:        "10:00",
		Status:         physio.PhysioApptStatus_PHYSIO_APPT_STATUS_SCHEDULED,
		Notes:          "Initial evaluation",
	}
	
	_, err := l8c.PostEntity("appointments", 54, appointment, vnic)
	if err != nil {
		t.Fatalf("Failed to create test appointment: %v", err)
	}
	
	return appointment
}

// CreateTestProgressLog creates a test progress log entity
func CreateTestProgressLog(t *testing.T, vnic ifs.IVNic, clientID, exerciseID string) *physio.ProgressLog {
	t.Helper()
	
	progressLog := &physio.ProgressLog{
		ClientId:    clientID,
		ExerciseId:  exerciseID,
		PainLevel:   2,
		Notes:       "Good progress",
		Completed:   true,
		ProgressEntry: &physio.ProgressEntry{
			ProgressEntryId: exerciseID,
			Completed:       true,
			SetsDone:        3,
			RepsDone:        10,
			PainLevel:       2,
		},
	}
	
	_, err := l8c.PostEntity("progress_logs", 55, progressLog, vnic)
	if err != nil {
		t.Fatalf("Failed to create test progress log: %v", err)
	}
	
	return progressLog
}
