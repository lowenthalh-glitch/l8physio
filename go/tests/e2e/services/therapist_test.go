package services

import (
	"testing"

	"github.com/saichler/l8core/go/l8c"
	ifs "github.com/saichler/l8core/go/types/ifs"
	"github.com/saichler/l8physio/go/tests/fixtures"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTherapistCRUD(t *testing.T) {
	// This test requires a real VNic connection
	// For now, we'll test the structure and validation
	vnic, err := l8c.NewVNic("test-therapist-crud")
	require.NoError(t, err)
	defer vnic.Close()

	// Create therapist
	therapist := fixtures.CreateTestTherapist(t, vnic)
	assert.NotEmpty(t, therapist.Id)
	assert.Equal(t, "Jane", therapist.FirstName)
	assert.Equal(t, "Smith", therapist.LastName)

	// Get therapist by ID
	getTherapist, err := l8c.GetEntity("therapists", 51, therapist.Id, vnic)
	require.NoError(t, err)
	assert.NotNil(t, getTherapist)

	// Query therapists
	query := "SELECT therapistId, firstName, lastName FROM PhysioTherapist WHERE isActive = 1"
	result, err := l8c.Query("therapists", 51, query, vnic)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(result.List), 1)

	// Update therapist
	therapist.Phone = "+15551112222"
	_, err = l8c.PutEntity("therapists", 51, therapist, vnic)
	require.NoError(t, err)

	// Verify update
	getTherapist2, err := l8c.GetEntity("therapists", 51, therapist.Id, vnic)
	require.NoError(t, err)
	assert.Equal(t, "+15551112222", getTherapist2.(*physio.PhysioTherapist).Phone)
}
