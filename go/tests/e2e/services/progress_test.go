package services

import (
	"testing"

	"github.com/saichler/l8core/go/l8c"
	ifs "github.com/saichler/l8core/go/types/ifs"
	"github.com/saichler/l8physio/go/tests/fixtures"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestProgressLogCRUD(t *testing.T) {
	// This test requires a real VNic connection
	vnic, err := l8c.NewVNic("test-progress-log-crud")
	require.NoError(t, err)
	defer vnic.Close()

	// Create therapist, client, and exercise for the progress log
	therapist := fixtures.CreateTestTherapist(t, vnic)
	client := fixtures.CreateTestClient(t, vnic)
	exercise := fixtures.CreateTestExercise(t, vnic)

	// Create progress log
	progressLog := fixtures.CreateTestProgressLog(t, vnic, client.Id, exercise.Id)
	assert.NotEmpty(t, progressLog.Id)
	assert.Equal(t, client.Id, progressLog.ClientId)
	assert.Equal(t, exercise.Id, progressLog.ExerciseId)

	// Get progress log by ID
	getProgressLog, err := l8c.GetEntity("progress_logs", 55, progressLog.Id, vnic)
	require.NoError(t, err)
	assert.NotNil(t, getProgressLog)

	// Query progress logs by client
	query := "SELECT * FROM ProgressLog WHERE clientId = '" + client.Id + "'"
	result, err := l8c.Query("progress_logs", 55, query, vnic)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(result.List), 1)

	// Query progress logs by exercise
	query2 := "SELECT * FROM ProgressLog WHERE exerciseId = '" + exercise.Id + "'"
	result2, err := l8c.Query("progress_logs", 55, query2, vnic)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(result2.List), 1)
}
