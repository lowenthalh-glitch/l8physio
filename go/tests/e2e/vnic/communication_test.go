package vnic

import (
	"testing"

	"github.com/saichler/l8common/go/common"
	ifs "github.com/saichler/l8types/go/ifs"
	"github.com/lowenthalh-glitch/l8physio/go/tests/fixtures"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestPOSTRequest tests POST request to client service
func TestPOSTRequest(t *testing.T) {
	vnic, err := l8c.NewVNic("test-post-request")
	require.NoError(t, err)
	defer vnic.Close()

	// Create a test client
	client := fixtures.CreateTestClient(t, vnic)
	
	assert.NotEmpty(t, client.Id)
	assert.Equal(t, "John", client.FirstName)
}

// TestGETRequest tests GET request to client service
func TestGETRequest(t *testing.T) {
	vnic, err := l8c.NewVNic("test-get-request")
	require.NoError(t, err)
	defer vnic.Close()

	// Create a test client first
	client := fixtures.CreateTestClient(t, vnic)

	// Get client by ID
	getClient, err := l8c.GetEntity("clients", 50, client.Id, vnic)
	require.NoError(t, err)
	assert.NotNil(t, getClient)

	// Cast and verify
	retrievedClient := getClient.(*struct {
		FirstName string
		LastName  string
		Id        string
	})
	assert.Equal(t, client.Id, retrievedClient.Id)
}

// TestPUTRequest tests PUT request to update client
func TestPUTRequest(t *testing.T) {
	vnic, err := l8c.NewVNic("test-put-request")
	require.NoError(t, err)
	defer vnic.Close()

	// Create a test client
	client := fixtures.CreateTestClient(t, vnic)

	// Update client
	client.Notes = "Updated via PUT request"
	_, err = l8c.PutEntity("clients", 50, client, vnic)
	require.NoError(t, err)

	// Verify update
	getClient, err := l8c.GetEntity("clients", 50, client.Id, vnic)
	require.NoError(t, err)
	assert.NotNil(t, getClient)

	// Cast and verify
	retrievedClient := getClient.(*struct {
		FirstName string
		LastName  string
		Notes     string
	})
	assert.Equal(t, "Updated via PUT request", retrievedClient.Notes)
}

// TestDELETERequest tests DELETE request (soft delete)
func TestDELETERequest(t *testing.T) {
	vnic, err := l8c.NewVNic("test-delete-request")
	require.NoError(t, err)
	defer vnic.Close()

	// Create a test client
	client := fixtures.CreateTestClient(t, vnic)

	// Soft delete
	client.IsActive = false
	_, err = l8c.PutEntity("clients", 50, client, vnic)
	require.NoError(t, err)

	// Verify soft delete
	getClient, err := l8c.GetEntity("clients", 50, client.Id, vnic)
	require.NoError(t, err)
	assert.NotNil(t, getClient)

	// Cast and verify
	retrievedClient := getClient.(*struct {
		FirstName string
		LastName  string
		IsActive  bool
	})
	assert.False(t, retrievedClient.IsActive)
}

// TestQueryWithL8QL tests L8QL query support
func TestQueryWithL8QL(t *testing.T) {
	vnic, err := l8c.NewVNic("test-query-l8ql")
	require.NoError(t, err)
	defer vnic.Close()

	// Create multiple clients
	therapist := fixtures.CreateTestTherapist(t, vnic)
	client1 := fixtures.CreateTestClient(t, vnic)
	client2 := fixtures.CreateTestClient(t, vnic)

	// Assign both clients to the same therapist
	client1.TherapistId = therapist.Id
	client2.TherapistId = therapist.Id

	_, err = l8c.PutEntity("clients", 50, client1, vnic)
	require.NoError(t, err)
	_, err = l8c.PutEntity("clients", 50, client2, vnic)
	require.NoError(t, err)

	// Query clients by therapist
	query := "SELECT * FROM PhysioClient WHERE therapistId = '" + therapist.Id + "'"
	result, err := l8c.Query("clients", 50, query, vnic)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(result.List), 2)
}

// TestPagination tests pagination support
func TestPagination(t *testing.T) {
	vnic, err := l8c.NewVNic("test-pagination")
	require.NoError(t, err)
	defer vnic.Close()

	// Query with pagination
	query := "SELECT * FROM PhysioClient LIMIT 10 PAGE 1"
	result, err := l8c.Query("clients", 50, query, vnic)
	require.NoError(t, err)
	assert.NotNil(t, result)
}

// TestSorting tests sorting support
func TestSorting(t *testing.T) {
	vnic, err := l8c.NewVNic("test-sorting")
	require.NoError(t, err)
	defer vnic.Close()

	// Query with sorting
	query := "SELECT * FROM PhysioClient SORT BY firstName ASC"
	result, err := l8c.Query("clients", 50, query, vnic)
	require.NoError(t, err)
	assert.NotNil(t, result)
}
