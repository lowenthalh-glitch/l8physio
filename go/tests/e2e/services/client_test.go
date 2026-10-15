package services

import (
	"testing"

	"github.com/saichler/l8common/go/common"
	ifs "github.com/saichler/l8types/go/ifs"
	"github.com/lowenthalh-glitch/l8physio/go/tests/fixtures"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClientCRUD(t *testing.T) {
	// This test requires a real VNic connection
	// For now, we'll test the structure and validation
	vnic, err := l8c.NewVNic("test-client-crud")
	require.NoError(t, err)
	defer vnic.Close()

	// Create client
	client := fixtures.CreateTestClient(t, vnic)
	assert.NotEmpty(t, client.Id)
	assert.Equal(t, "John", client.FirstName)
	assert.Equal(t, "Doe", client.LastName)

	// Get client by ID
	getClient, err := l8c.GetEntity("clients", 50, client.Id, vnic)
	require.NoError(t, err)
	assert.NotNil(t, getClient)

	// Query clients
	query := "SELECT * FROM PhysioClient WHERE therapistId = 'therapist-1'"
	result, err := l8c.Query("clients", 50, query, vnic)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(result.List), 1)

	// Update client
	client.Notes = "Updated notes for E2E test"
	_, err = l8c.PutEntity("clients", 50, client, vnic)
	require.NoError(t, err)

	// Verify update
	getClient2, err := l8c.GetEntity("clients", 50, client.Id, vnic)
	require.NoError(t, err)
	assert.Equal(t, "Updated notes for E2E test", getClient2.(*physio.PhysioClient).Notes)

	// Delete client (soft delete)
	client.IsActive = false
	_, err = l8c.PutEntity("clients", 50, client, vnic)
	require.NoError(t, err)
}
