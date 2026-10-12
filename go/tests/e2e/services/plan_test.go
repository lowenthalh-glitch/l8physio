package services

import (
	"testing"

	"github.com/saichler/l8core/go/l8c"
	ifs "github.com/saichler/l8core/go/types/ifs"
	"github.com/saichler/l8physio/go/tests/fixtures"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPlanCRUD(t *testing.T) {
	// This test requires a real VNic connection
	vnic, err := l8c.NewVNic("test-plan-crud")
	require.NoError(t, err)
	defer vnic.Close()

	// Create therapist and client for the plan
	therapist := fixtures.CreateTestTherapist(t, vnic)
	client := fixtures.CreateTestClient(t, vnic)
	exercise := fixtures.CreateTestExercise(t, vnic)

	// Create protocol
	protocol := fixtures.CreateTestProtocol(t, vnic)

	// Create plan
	plan := &struct {
		ClientId    string   `json:"clientId"`
		TherapistId string   `json:"therapistId"`
		ProtocolId  string   `json:"protocolId"`
		ExerciseIds []string `json:"exerciseIds"`
		Status      int32    `json:"status"`
		Name        string   `json:"name"`
	}{
		ClientId:    client.Id,
		TherapistId: therapist.Id,
		ProtocolId:  protocol.Id,
		ExerciseIds: []string{exercise.Id},
		Status:      1,
		Name:        "Test Treatment Plan",
	}

	_, err = l8c.PostEntity("plans", 56, plan, vnic)
	require.NoError(t, err)

	// Query plans by client
	query := "SELECT * FROM PhysioPlan WHERE clientId = '" + client.Id + "'"
	result, err := l8c.Query("plans", 56, query, vnic)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(result.List), 1)

	// Query plans by status
	query2 := "SELECT * FROM PhysioPlan WHERE status = 1"
	result2, err := l8c.Query("plans", 56, query2, vnic)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(result2.List), 1)
}
