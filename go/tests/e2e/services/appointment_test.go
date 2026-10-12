package services

import (
	"testing"
	"time"

	"github.com/saichler/l8core/go/l8c"
	ifs "github.com/saichler/l8core/go/types/ifs"
	"github.com/saichler/l8physio/go/tests/fixtures"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAppointmentCRUD(t *testing.T) {
	// This test requires a real VNic connection
	vnic, err := l8c.NewVNic("test-appointment-crud")
	require.NoError(t, err)
	defer vnic.Close()

	// Create therapist and client for the appointment
	therapist := fixtures.CreateTestTherapist(t, vnic)
	client := fixtures.CreateTestClient(t, vnic)

	// Create appointment
	appointment := fixtures.CreateTestAppointment(t, vnic, client.Id, therapist.Id)
	assert.NotEmpty(t, appointment.Id)
	assert.Equal(t, client.Id, appointment.ClientId)
	assert.Equal(t, therapist.Id, appointment.TherapistId)

	// Get appointment by ID
	getAppointment, err := l8c.GetEntity("appointments", 54, appointment.Id, vnic)
	require.NoError(t, err)
	assert.NotNil(t, getAppointment)

	// Query appointments by client
	query := "SELECT * FROM Appointment WHERE clientId = '" + client.Id + "'"
	result, err := l8c.Query("appointments", 54, query, vnic)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(result.List), 1)

	// Query appointments by therapist
	query2 := "SELECT * FROM Appointment WHERE therapistId = '" + therapist.Id + "'"
	result2, err := l8c.Query("appointments", 54, query2, vnic)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(result2.List), 1)

	// Query with date range
	today := time.Now().Format("2006-01-02")
	tomorrow := time.Now().Add(48 * time.Hour).Format("2006-01-02")
	query3 := "SELECT * FROM Appointment WHERE apptDate >= '" + today + "' AND apptDate <= '" + tomorrow + "'"
	result3, err := l8c.Query("appointments", 54, query3, vnic)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(result3.List), 1)
}
