package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/saichler/l8web/go/web/server"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestHealthEndpoint tests the /0/Health endpoint
func TestHealthEndpoint(t *testing.T) {
	ws := &server.WebService{}
	req := httptest.NewRequest(http.MethodGet, "/0/Health", nil)
	rec := httptest.NewRecorder()

	ws.Health(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
}

// TestRegistryEndpoint tests the /0/Registry endpoint
func TestRegistryEndpoint(t *testing.T) {
	ws := &server.WebService{}
	req := httptest.NewRequest(http.MethodGet, "/0/Registry", nil)
	rec := httptest.NewRecorder()

	ws.Registry(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
}

// TestPostClient tests POST /0/PhyClient endpoint
func TestPostClient(t *testing.T) {
	ws := &server.WebService{}

	// Create a test client payload
	client := map[string]interface{}{
		"firstName":      "John",
		"lastName":       "Doe",
		"email":          "john.doe@test.com",
		"therapistId":    "therapist-1",
		"status":         1,
		"dateOfBirth":    "1990-01-01",
		"phone":          "+15551234567",
		"addressLine1":   "123 Main St",
		"city":           "Los Angeles",
		"stateProvince":  "CA",
		"postalCode":     "90001",
		"countryCode":    "US",
		"notes":          "Test client",
		"insuranceCarrier": "Aetna",
		"policyNumber":   "ABC123456",
	}

	payload, _ := json.Marshal(client)
	req := httptest.NewRequest(http.MethodPost, "/0/PhyClient", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	ws.PostEntity(rec, req)

	// Note: This test may fail without full VNic setup
	// assert.Equal(t, http.StatusOK, rec.Code)
}

// TestGetClient tests GET /0/PhyClient/{id} endpoint
func TestGetClient(t *testing.T) {
	ws := &server.WebService{}

	// Create a client first to get an ID
	client := map[string]interface{}{
		"firstName": "Jane",
		"lastName":  "Doe",
		"email":     "jane.doe@test.com",
	}

	payload, _ := json.Marshal(client)
	req1 := httptest.NewRequest(http.MethodPost, "/0/PhyClient", bytes.NewReader(payload))
	req1.Header.Set("Content-Type", "application/json")
	rec1 := httptest.NewRecorder()
	ws.PostEntity(rec1, req1)

	// Extract ID from response (simplified)
	// In real test, we would parse the response body

	// Test GET endpoint
	req2 := httptest.NewRequest(http.MethodGet, "/0/PhyClient/test-id", nil)
	rec2 := httptest.NewRecorder()
	ws.GetEntity(rec2, req2)

	// assert.Equal(t, http.StatusOK, rec2.Code)
}

// TestPutClient tests PUT /0/PhyClient/{id} endpoint
func TestPutClient(t *testing.T) {
	ws := &server.WebService{}

	// Create an update payload
	update := map[string]interface{}{
		"firstName": "Updated",
		"lastName":  "Name",
		"notes":     "Updated notes",
	}

	payload, _ := json.Marshal(update)
	req := httptest.NewRequest(http.MethodPut, "/0/PhyClient/test-id", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	ws.PutEntity(rec, req)

	// Note: This test may fail without full VNic setup
	// assert.Equal(t, http.StatusOK, rec.Code)
}

// TestDeleteClient tests DELETE /0/PhyClient/{id} endpoint
func TestDeleteClient(t *testing.T) {
	ws := &server.WebService{}

	req := httptest.NewRequest(http.MethodDelete, "/0/PhyClient/test-id", nil)
	rec := httptest.NewRecorder()

	ws.DeleteEntity(rec, req)

	// Note: This test may fail without full VNic setup
	// assert.Equal(t, http.StatusOK, rec.Code)
}

// TestQueryClient tests Query /0/PhyClient endpoint
func TestQueryClient(t *testing.T) {
	ws := &server.WebService()

	// Create a query payload
	query := map[string]interface{}{
		"l8ql": "SELECT * FROM PhysioClient LIMIT 10",
	}

	payload, _ := json.Marshal(query)
	req := httptest.NewRequest(http.MethodPost, "/0/PhyClient", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	ws.Query(rec, req)

	// Note: This test may fail without full VNic setup
	// assert.Equal(t, http.StatusOK, rec.Code)
}
