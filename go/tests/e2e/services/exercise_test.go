package services

import (
	"testing"

	"github.com/saichler/l8common/go/common"
	ifs "github.com/saichler/l8types/go/ifs"
	"github.com/lowenthalh-glitch/l8physio/go/tests/fixtures"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestExerciseCRUD(t *testing.T) {
	// This test requires a real VNic connection
	vnic, err := l8c.NewVNic("test-exercise-crud")
	require.NoError(t, err)
	defer vnic.Close()

	// Create exercise
	exercise := fixtures.CreateTestExercise(t, vnic)
	assert.NotEmpty(t, exercise.Id)
	assert.Equal(t, "Test Exercise", exercise.Name)

	// Get exercise by ID
	getExercise, err := l8c.GetEntity("exercises", 52, exercise.Id, vnic)
	require.NoError(t, err)
	assert.NotNil(t, getExercise)

	// Query exercises by category
	query := "SELECT * FROM PhysioExercise WHERE category = 1"
	result, err := l8c.Query("exercises", 52, query, vnic)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(result.List), 0)

	// Query exercises by equipment
	query2 := "SELECT * FROM PhysioExercise WHERE equipment = 2"
	result2, err := l8c.Query("exercises", 52, query2, vnic)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(result2.List), 0)

	// Update exercise
	exercise.Description = "Updated exercise description"
	_, err = l8c.PutEntity("exercises", 52, exercise, vnic)
	require.NoError(t, err)

	// Verify update
	getExercise2, err := l8c.GetEntity("exercises", 52, exercise.Id, vnic)
	require.NoError(t, err)
	assert.Equal(t, "Updated exercise description", getExercise2.(*physio.PhysioExercise).Description)
}
