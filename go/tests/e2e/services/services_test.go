package services

import (
	"testing"

	"github.com/lowenthalh-glitch/l8physio/go/physio/appointments"
	"github.com/lowenthalh-glitch/l8physio/go/physio/clients"
	"github.com/lowenthalh-glitch/l8physio/go/physio/exercises"
	"github.com/lowenthalh-glitch/l8physio/go/physio/plans"
	"github.com/lowenthalh-glitch/l8physio/go/physio/progress"
	"github.com/lowenthalh-glitch/l8physio/go/physio/protocols"
	"github.com/lowenthalh-glitch/l8physio/go/physio/therapists"
	"github.com/lowenthalh-glitch/l8physio/go/tests/e2e/testenv"
	"github.com/lowenthalh-glitch/l8physio/go/tests/fixtures"
	"github.com/lowenthalh-glitch/l8physio/go/types/physio"
	l8c "github.com/saichler/l8common/go/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// These tests need a running physio system; see testenv.EnvVar.

func TestClientCRUD(t *testing.T) {
	vnic := testenv.NewVnic(t)

	client := fixtures.CreateTestClient(t, vnic)
	require.NotEmpty(t, client.ClientId)
	assert.Equal(t, "John", client.FirstName)

	got, err := clients.Client(client.ClientId, vnic)
	require.NoError(t, err)
	assert.Equal(t, client.Email, got.Email)

	got.MedicalHistory = "Updated for E2E test"
	require.NoError(t, l8c.PutEntity(clients.ServiceName, clients.ServiceArea, got, vnic))

	got, err = clients.Client(client.ClientId, vnic)
	require.NoError(t, err)
	assert.Equal(t, "Updated for E2E test", got.MedicalHistory)

	// Creating a client without the required fields must be rejected.
	_, err = l8c.PostEntity(clients.ServiceName, clients.ServiceArea, &physio.PhysioClient{FirstName: "NoEmail"}, vnic)
	assert.Error(t, err)
}

func TestTherapistCRUD(t *testing.T) {
	vnic := testenv.NewVnic(t)

	therapist := fixtures.CreateTestTherapist(t, vnic)
	require.NotEmpty(t, therapist.TherapistId)

	res, err := l8c.GetEntity(therapists.ServiceName, therapists.ServiceArea,
		&physio.PhysioTherapist{TherapistId: therapist.TherapistId}, vnic)
	require.NoError(t, err)
	got := res.(*physio.PhysioTherapist)
	assert.Equal(t, "Orthopedics", got.Specialization)

	got.Specialization = "Sports"
	got.IsActive = false
	require.NoError(t, l8c.PutEntity(therapists.ServiceName, therapists.ServiceArea, got, vnic))

	res, err = l8c.GetEntity(therapists.ServiceName, therapists.ServiceArea,
		&physio.PhysioTherapist{TherapistId: therapist.TherapistId}, vnic)
	require.NoError(t, err)
	assert.Equal(t, "Sports", res.(*physio.PhysioTherapist).Specialization)
	assert.False(t, res.(*physio.PhysioTherapist).IsActive)
}

func TestExerciseAndProtocolCRUD(t *testing.T) {
	vnic := testenv.NewVnic(t)

	exercise := fixtures.CreateTestExercise(t, vnic)
	require.NotEmpty(t, exercise.ExerciseId)
	res, err := l8c.GetEntity(exercises.ServiceName, exercises.ServiceArea,
		&physio.PhysioExercise{ExerciseId: exercise.ExerciseId}, vnic)
	require.NoError(t, err)
	assert.Equal(t, exercise.Name, res.(*physio.PhysioExercise).Name)

	protocol := fixtures.CreateTestProtocol(t, vnic)
	require.NotEmpty(t, protocol.ProtocolId)
	res, err = l8c.GetEntity(protocols.ServiceName, protocols.ServiceArea,
		&physio.PhysioProtocol{ProtocolId: protocol.ProtocolId}, vnic)
	require.NoError(t, err)
	assert.Equal(t, protocol.Name, res.(*physio.PhysioProtocol).Name)
}

func TestPlanCRUD(t *testing.T) {
	vnic := testenv.NewVnic(t)

	client := fixtures.CreateTestClient(t, vnic)
	therapist := fixtures.CreateTestTherapist(t, vnic)

	plan := fixtures.CreateTestPlan(t, vnic, client.ClientId, therapist.TherapistId)
	require.NotEmpty(t, plan.PlanId)

	res, err := l8c.GetEntity(plans.ServiceName, plans.ServiceArea, &physio.TreatmentPlan{PlanId: plan.PlanId}, vnic)
	require.NoError(t, err)
	got := res.(*physio.TreatmentPlan)
	assert.Equal(t, client.ClientId, got.ClientId)

	// A plan without a client is invalid.
	_, err = l8c.PostEntity(plans.ServiceName, plans.ServiceArea,
		&physio.TreatmentPlan{UserId: therapist.TherapistId, Title: "no client"}, vnic)
	assert.Error(t, err)
}

func TestAppointmentCRUD(t *testing.T) {
	vnic := testenv.NewVnic(t)

	client := fixtures.CreateTestClient(t, vnic)
	therapist := fixtures.CreateTestTherapist(t, vnic)

	appt := fixtures.CreateTestAppointment(t, vnic, client.ClientId, therapist.TherapistId, therapist.TherapistId)
	require.NotEmpty(t, appt.ApptId)

	res, err := l8c.GetEntity(appointments.ServiceName, appointments.ServiceArea,
		&physio.Appointment{ApptId: appt.ApptId}, vnic)
	require.NoError(t, err)
	got := res.(*physio.Appointment)
	assert.Equal(t, client.ClientId, got.ClientId)
	assert.Equal(t, therapist.TherapistId, got.TherapistId)

	// An appointment ending before it starts is invalid.
	_, err = l8c.PostEntity(appointments.ServiceName, appointments.ServiceArea, &physio.Appointment{
		ClientId: client.ClientId, UserId: therapist.TherapistId,
		StartTime: appt.EndTime, EndTime: appt.StartTime,
	}, vnic)
	assert.Error(t, err)
}

func TestProgressLogCRUD(t *testing.T) {
	vnic := testenv.NewVnic(t)

	client := fixtures.CreateTestClient(t, vnic)
	therapist := fixtures.CreateTestTherapist(t, vnic)
	exercise := fixtures.CreateTestExercise(t, vnic)
	plan := fixtures.CreateTestPlan(t, vnic, client.ClientId, therapist.TherapistId)

	log := fixtures.CreateTestProgressLog(t, vnic, client.ClientId, plan.PlanId, therapist.TherapistId, exercise.ExerciseId)
	require.NotEmpty(t, log.LogId)

	res, err := l8c.GetEntity(progress.ServiceName, progress.ServiceArea, &physio.ProgressLog{LogId: log.LogId}, vnic)
	require.NoError(t, err)
	got := res.(*physio.ProgressLog)
	assert.Equal(t, int32(2), got.OverallPainLevel)
	require.Len(t, got.Entries, 1)
	assert.Equal(t, exercise.ExerciseId, got.Entries[0].ExerciseId)
	assert.NotEmpty(t, got.Entries[0].ProgressEntryId)
}
