package mocks

import (
	"fmt"
	"math/rand"

	"github.com/saichler/l8physio/go/types/physio"
)

// generatePhysioClients creates 30 physio client records with realistic distributions
func generatePhysioClients() []*physio.PhysioClient {
	clients := make([]*physio.PhysioClient, 30)

	for i := 0; i < 30; i++ {
		firstName := patientFirstNames[rand.Intn(len(patientFirstNames))]
		lastName := patientLastNames[rand.Intn(len(patientLastNames))]
		email := fmt.Sprintf("%s.%s%d@example.com", sanitizeEmail(firstName), sanitizeEmail(lastName), i+1)

		// Status distribution: 70% Active, 15% Inactive, 15% Discharged
		var status physio.PhysioClientStatus
		switch {
		case i < 21:
			status = physio.PhysioClientStatus_PHYSIO_CLIENT_STATUS_ACTIVE
		case i < 25:
			status = physio.PhysioClientStatus_PHYSIO_CLIENT_STATUS_INACTIVE
		default:
			status = physio.PhysioClientStatus_PHYSIO_CLIENT_STATUS_DISCHARGED
		}

		clients[i] = &physio.PhysioClient{
			ClientId:         genID("cli", i),
			FirstName:        firstName,
			LastName:         lastName,
			Email:            email,
			Phone:            randomPhone(),
			DateOfBirth:      randomBirthDate(),
			Status:           status,
			ReferralSource:   referralSources[i%len(referralSources)],
			Diagnosis:        diagnoses[i%len(diagnoses)],
			MedicalHistory:   fmt.Sprintf("No significant prior medical history. Presenting with %s.", diagnoses[i%len(diagnoses)]),
			EmergencyContact: fmt.Sprintf("%s %s - %s", patientFirstNames[rand.Intn(len(patientFirstNames))], patientLastNames[rand.Intn(len(patientLastNames))], randomPhone()),
			AuditInfo:        createAuditInfo(),
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
	if len(store.PhysioTherapistIDs) > 0 {
		for i, c := range clients {
			c.TherapistId = store.PhysioTherapistIDs[i%len(store.PhysioTherapistIDs)]
		}
	}
	return clients
}
