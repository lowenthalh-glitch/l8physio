package mocks

import (
	"fmt"
	"math/rand"

	lm "github.com/saichler/l8common/go/mocks"
	"github.com/saichler/l8physio/go/types/physio"
)

// generatePhysioClients creates 10 physio client records
func generatePhysioClients() []*physio.PhysioClient {
	count := 10
	clients := make([]*physio.PhysioClient, count)

	for i := 0; i < count; i++ {
		firstName := patientFirstNames[i%len(patientFirstNames)]
		lastName := patientLastNames[i%len(patientLastNames)]
		email := fmt.Sprintf("%s.%s%d@example.com", lm.SanitizeEmail(firstName), lm.SanitizeEmail(lastName), i+1)

		// Status: 80% Active, 20% Inactive
		var status physio.PhysioClientStatus
		if i < 8 {
			status = physio.PhysioClientStatus_PHYSIO_CLIENT_STATUS_ACTIVE
		} else {
			status = physio.PhysioClientStatus_PHYSIO_CLIENT_STATUS_INACTIVE
		}

		clients[i] = &physio.PhysioClient{
			ClientId:         lm.GenID("cli", i),
			FirstName:        firstName,
			LastName:         lastName,
			Email:            email,
			Phone:            lm.RandomPhone(),
			DateOfBirth:      lm.RandomBirthDate(),
			Status:           status,
			ReferralSource:   referralSources[i%len(referralSources)],
			Diagnosis:        diagnoses[i%len(diagnoses)],
			MedicalHistory:   fmt.Sprintf("No significant prior medical history. Presenting with %s.", diagnoses[i%len(diagnoses)]),
			EmergencyContact: fmt.Sprintf("%s %s - %s", patientFirstNames[rand.Intn(len(patientFirstNames))], patientLastNames[rand.Intn(len(patientLastNames))], lm.RandomPhone()),
			AuditInfo:        lm.CreateAuditInfo(),
		}
	}

	return clients
}

// assignClientProtocols updates clients with protocol and therapist IDs once they are available
func assignClientProtocols(clients []*physio.PhysioClient, store *MockDataStore) []*physio.PhysioClient {
	if len(store.PhysioProtocolIDs) > 0 {
		for i, c := range clients {
			c.ProtocolId = store.PhysioProtocolIDs[i%len(store.PhysioProtocolIDs)]
		}
	}
	// Distribute 10 clients across 3 therapists: 4, 3, 3
	if len(store.PhysioTherapistIDs) > 0 {
		for i, c := range clients {
			c.TherapistId = store.PhysioTherapistIDs[i%len(store.PhysioTherapistIDs)]
		}
	}
	return clients
}
