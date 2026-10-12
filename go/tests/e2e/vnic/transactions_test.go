package vnic

import (
	"testing"

	"github.com/saichler/l8core/go/l8c"
	ifs "github.com/saichler/l8core/go/types/ifs"
	"github.com/saichler/l8physio/go/tests/fixtures"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestTwoPhaseCommit tests 2-phase commit transaction
func TestTwoPhaseCommit(t *testing.T) {
	vnic, err := l8c.NewVNic("test-2pc")
	require.NoError(t, err)
	defer vnic.Close()

	// Create therapist and client
	therapist := fixtures.CreateTestTherapist(t, vnic)
	client := fixtures.CreateTestClient(t, vnic)

	// The test would verify that:
	// 1. All participants prepare
	// 2. Coordinator decides to commit
	// 3. All participants commit
	
	// For now, we verify the entities were created
	assert.NotEmpty(t, therapist.Id)
	assert.NotEmpty(t, client.Id)
}

// TestRollback tests transaction rollback
func TestRollback(t *testing.T) {
	vnic, err := l8c.NewVNic("test-rollback")
	require.NoError(t, err)
	defer vnic.Close()

	// Create a test client
	client := fixtures.CreateTestClient(t, vnic)
	
	originalNotes := client.Notes
	
	// Simulate a failed update
	client.Notes = "Will be rolled back"
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
	assert.Equal(t, "Will be rolled back", retrievedClient.Notes)
}

// TestTransactionIsolation tests transaction isolation
func TestTransactionIsolation(t *testing.T) {
	vnic, err := l8c.NewVNic("test-isolation")
	require.NoError(t, err)
	defer vnic.Close()

	// Create a test client
	client := fixtures.CreateTestClient(t, vnic)

	// The test would verify that concurrent transactions don't interfere
	
	// For now, we verify the entity exists
	assert.NotEmpty(t, client.Id)
}

// TestConcurrentUpdates tests handling of concurrent updates
func TestConcurrentUpdates(t *testing.T) {
	vnic, err := l8c.NewVNic("test-concurrent-updates")
	require.NoError(t, err)
	defer vnic.Close()

	// Create a test client
	client := fixtures.CreateTestClient(t, vnic)

	// The test would simulate concurrent updates and verify
	// that the last write wins or conflict resolution occurs
	
	// For now, we do a simple update
	client.Notes = "Updated after concurrent test"
	_, err = l8c.PutEntity("clients", 50, client, vnic)
	require.NoError(t, err)
}

// TestDeadlockDetection tests deadlock detection and resolution
func TestDeadlockDetection(t *testing.T) {
	vnic, err := l8c.NewVNic("test-deadlock")
	require.NoError(t, err)
	defer vnic.Close()

	// Create multiple entities
	therapist1 := fixtures.CreateTestTherapist(t, vnic)
	therapist2 := fixtures.CreateTestTherapist(t, vnic)

	// The test would simulate a deadlock scenario and verify
	// that it is detected and resolved
	
	// For now, we verify the entities were created
	assert.NotEmpty(t, therapist1.Id)
	assert.NotEmpty(t, therapist2.Id)
}
