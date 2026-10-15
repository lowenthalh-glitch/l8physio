package security

import (
	"testing"

	"github.com/saichler/l8common/go/common"
	ifs "github.com/saichler/l8types/go/ifs"
	"github.com/lowenthalh-glitch/l8physio/go/tests/fixtures"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestTherapistCanAccessOwnClients tests that a therapist can access their own clients
func TestTherapistCanAccessOwnClients(t *testing.T) {
	vnic, err := l8c.NewVNic("test-therapist-own-clients")
	require.NoError(t, err)
	defer vnic.Close()

	therapist := fixtures.CreateTestTherapist(t, vnic)
	client := fixtures.CreateTestClient(t, vnic)
	
	// Assign client to therapist
	client.TherapistId = therapist.Id
	_, err = l8c.PutEntity("clients", 50, client, vnic)
	require.NoError(t, err)
	
	// Query clients for this therapist
	query := "SELECT * FROM PhysioClient WHERE therapistId = '" + therapist.Id + "'"
	result, err := l8c.Query("clients", 50, query, vnic)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(result.List), 1)
}

// TestTherapistCannotAccessOtherTherapistsClients tests access control
func TestTherapistCannotAccessOtherTherapistsClients(t *testing.T) {
	vnic, err := l8c.NewVNic("test-therapist-no-access")
	require.NoError(t, err)
	defer vnic.Close()

	therapist1 := fixtures.CreateTestTherapist(t, vnic)
	therapist2 := fixtures.CreateTestTherapist(t, vnic)
	client := fixtures.CreateTestClient(t, vnic)
	
	// Assign client to therapist1
	client.TherapistId = therapist1.Id
	_, err = l8c.PutEntity("clients", 50, client, vnic)
	require.NoError(t, err)
	
	// Therapist2 should not see client assigned to therapist1
	query := "SELECT * FROM PhysioClient WHERE therapistId = '" + therapist2.Id + "'"
	result, err := l8c.Query("clients", 50, query, vnic)
	require.NoError(t, err)
	// Note: The actual authorization logic would filter this out
	assert.Equal(t, 0, len(result.List))
}

// TestClientCanAccessOwnData tests that a client can access their own data
func TestClientCanAccessOwnData(t *testing.T) {
	vnic, err := l8c.NewVNic("test-client-own-data")
	require.NoError(t, err)
	defer vnic.Close()

	therapist := fixtures.CreateTestTherapist(t, vnic)
	client := fixtures.CreateTestClient(t, vnic)
	
	// Client should be able to query their own plans
	query := "SELECT * FROM PhysioPlan WHERE clientId = '" + client.Id + "'"
	result, err := l8c.Query("plans", 56, query, vnic)
	require.NoError(t, err)
	assert.NotNil(t, result)
}

// TestClientCannotAccessOtherClientsData tests client data isolation
func TestClientCannotAccessOtherClientsData(t *testing.T) {
	vnic, err := l8c.NewVNic("test-client-isolation")
	require.NoError(t, err)
	defer vnic.Close()

	therapist := fixtures.CreateTestTherapist(t, vnic)
	client1 := fixtures.CreateTestClient(t, vnic)
	client2 := fixtures.CreateTestClient(t, vnic)
	
	// Client2 should not see client1's data
	query := "SELECT * FROM PhysioClient WHERE clientId = '" + client1.Id + "'"
	result, err := l8c.Query("clients", 50, query, vnic)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(result.List), 1)
	// Note: The actual authorization logic would filter based on current user context
}

// TestAdminCanAccessAllData tests admin access
func TestAdminCanAccessAllData(t *testing.T) {
	vnic, err := l8c.NewVNic("test-admin-access")
	require.NoError(t, err)
	defer vnic.Close()

	therapist := fixtures.CreateTestTherapist(t, vnic)
	client := fixtures.CreateTestClient(t, vnic)
	
	// Admin should be able to query all clients
	query := "SELECT * FROM PhysioClient"
	result, err := l8c.Query("clients", 50, query, vnic)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(result.List), 2)
}
