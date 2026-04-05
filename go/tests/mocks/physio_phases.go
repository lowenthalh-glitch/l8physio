package mocks

import (
	"encoding/json"
	"fmt"

	"github.com/saichler/l8physio/go/types/physio"
)

// RunAllPhases executes all physio data phases in dependency order
func RunAllPhases(client *PhysioClient, store *MockDataStore) {
	runPhysioPhase1(client, store) // Therapists & Exercises (no dependencies)
	runPhysioPhase5(client, store) // Protocols (needs exercises) — moved before clients
	runPhysioPhase1b(client, store) // Clients with protocolId assigned at creation
	// Treatment plans are created via the Workout Builder UI, not mock data
	// runPhysioPhase2(client, store)
	runPhysioPhase3(client, store) // Appointments (needs clients)
	runPhysioPhase4(client, store) // Progress Logs (needs clients, appointments)
	runPhysioPhase6(client, store) // Create user accounts (username=email, password=1234)
}

// runPhysioPhase1 generates therapists and exercises — no cross-entity dependencies
func storeExercises(exercises []*physio.PhysioExercise, store *MockDataStore) {
	if store.PhysioExerciseCategories == nil {
		store.PhysioExerciseCategories = make(map[string]int32)
	}
	for _, e := range exercises {
		store.PhysioExerciseIDs = append(store.PhysioExerciseIDs, e.ExerciseId)
		store.PhysioExerciseCategories[e.ExerciseId] = int32(e.Category)
	}
}

func runPhysioPhase1(client *PhysioClient, store *MockDataStore) {
	fmt.Printf("=== Phase 1: Therapists & Exercises ===\n")

	// Therapists
	therapists := generatePhysioTherapists()
	_, err := client.Post("/physio/50/PhyTherapt", &physio.PhysioTherapistList{List: therapists})
	if err != nil {
		fmt.Printf("  ERROR creating PhysioTherapists: %v\n", err)
	} else {
		for _, t := range therapists {
			store.PhysioTherapistIDs = append(store.PhysioTherapistIDs, t.TherapistId)
		}
		fmt.Printf("  Created %d PhysioTherapists\n", len(therapists))
	}

	// Synthetic exercises (broad category coverage)
	exercises := generatePhysioExercises()
	_, err = client.Post("/physio/50/PhyExercis", &physio.PhysioExerciseList{List: exercises})
	if err != nil {
		fmt.Printf("  ERROR creating PhysioExercises: %v\n", err)
	} else {
		storeExercises(exercises, store)
		fmt.Printf("  Created %d PhysioExercises\n", len(exercises))
	}

	// Classified exercises from client's rehab protocol builder (full joint/posture/phase classification)
	rehabExercises := generateRehabBankExercises()
	_, err = client.Post("/physio/50/PhyExercis", &physio.PhysioExerciseList{List: rehabExercises})
	if err != nil {
		fmt.Printf("  ERROR creating rehab bank exercises: %v\n", err)
	} else {
		storeExercises(rehabExercises, store)
		fmt.Printf("  Created %d rehab bank exercises\n", len(rehabExercises))
	}

	// Client exercises (manually curated from protocols.xlsx with full classification)
	clientExercises := generateClientExercises()
	_, err = client.Post("/physio/50/PhyExercis", &physio.PhysioExerciseList{List: clientExercises})
	if err != nil {
		fmt.Printf("  ERROR creating client exercises: %v\n", err)
	} else {
		storeExercises(clientExercises, store)
		fmt.Printf("  Created %d client exercises\n", len(clientExercises))
	}
}

// runPhysioPhase1b creates clients with protocolId already set (requires Phase 5 protocols)
func runPhysioPhase1b(client *PhysioClient, store *MockDataStore) {
	fmt.Printf("=== Phase 1b: Clients (with protocol assignment) ===\n")

	clients := generatePhysioClients()
	clients = assignClientProtocols(clients, store)
	_, err := client.Post("/physio/50/PhyClient", &physio.PhysioClientList{List: clients})
	if err != nil {
		fmt.Printf("  ERROR creating PhysioClients: %v\n", err)
	} else {
		for _, c := range clients {
			store.PhysioClientIDs = append(store.PhysioClientIDs, c.ClientId)
		}
		fmt.Printf("  Created %d PhysioClients\n", len(clients))
	}
}

// runPhysioPhase2 generates treatment plans (requires clients and exercises)
func runPhysioPhase2(client *PhysioClient, store *MockDataStore) {
	fmt.Printf("=== Phase 2: Treatment Plans ===\n")

	if len(store.PhysioExerciseIDs) == 0 {
		fmt.Printf("  SKIPPED: no exercises available (Phase 1 may have failed)\n")
		return
	}

	plans := generateTreatmentPlans(store)
	_, err := client.Post("/physio/50/PhyPlan", &physio.TreatmentPlanList{List: plans})
	if err != nil {
		fmt.Printf("  ERROR creating TreatmentPlans: %v\n", err)
	} else {
		for _, p := range plans {
			store.TreatmentPlanIDs = append(store.TreatmentPlanIDs, p.PlanId)
		}
		fmt.Printf("  Created %d TreatmentPlans\n", len(plans))
	}
}

// runPhysioPhase3 generates appointments (requires clients and plans)
func runPhysioPhase3(client *PhysioClient, store *MockDataStore) {
	fmt.Printf("=== Phase 3: Appointments ===\n")

	if len(store.PhysioClientIDs) == 0 || len(store.TreatmentPlanIDs) == 0 {
		fmt.Printf("  SKIPPED: missing clients or plans (earlier phase may have failed)\n")
		return
	}

	appointments := generateAppointments(store)
	_, err := client.Post("/physio/50/PhyAppt", &physio.AppointmentList{List: appointments})
	if err != nil {
		fmt.Printf("  ERROR creating Appointments: %v\n", err)
	} else {
		for _, a := range appointments {
			store.AppointmentIDs = append(store.AppointmentIDs, a.ApptId)
		}
		fmt.Printf("  Created %d Appointments\n", len(appointments))
	}
}

// runPhysioPhase4 generates progress logs (requires clients, plans, and appointments)
func runPhysioPhase4(client *PhysioClient, store *MockDataStore) {
	fmt.Printf("=== Phase 4: Progress Logs ===\n")

	if len(store.PhysioExerciseIDs) == 0 || len(store.TreatmentPlanIDs) == 0 || len(store.AppointmentIDs) == 0 {
		fmt.Printf("  SKIPPED: missing exercises, plans, or appointments (earlier phase may have failed)\n")
		return
	}

	logs := generateProgressLogs(store)
	_, err := client.Post("/physio/50/PhyLog", &physio.ProgressLogList{List: logs})
	if err != nil {
		fmt.Printf("  ERROR creating ProgressLogs: %v\n", err)
	} else {
		for _, l := range logs {
			store.ProgressLogIDs = append(store.ProgressLogIDs, l.LogId)
		}
		fmt.Printf("  Created %d ProgressLogs\n", len(logs))
	}
}

// runPhysioPhase5 generates protocol templates from client data (requires exercises)
func runPhysioPhase5(client *PhysioClient, store *MockDataStore) {
	fmt.Printf("=== Phase 5: Protocol Templates ===\n")

	if len(store.PhysioExerciseIDs) == 0 {
		fmt.Printf("  SKIPPED: no exercises available\n")
		return
	}

	// Protocols from protocols.xlsx — one record per unique protocol name with all exercises embedded
	protocols := generateClientProtocols()
	_, err := client.Post("/physio/50/PhyProto", &physio.PhysioProtocolList{List: protocols})
	if err != nil {
		fmt.Printf("  ERROR creating PhysioProtocols: %v\n", err)
	} else {
		for _, p := range protocols {
			store.PhysioProtocolIDs = append(store.PhysioProtocolIDs, p.ProtocolId)
		}
		fmt.Printf("  Created %d PhysioProtocols\n", len(protocols))
	}
}

// runPhysioPhase6 creates login accounts for all clients and therapists
func runPhysioPhase6(client *PhysioClient, store *MockDataStore) {
	fmt.Printf("=== Phase 6: User Logins ===\n")

	createUsersFromService(client, "/physio/50/PhyClient", "PhysioClient", "client")
	createUsersFromService(client, "/physio/50/PhyTherapt", "PhysioTherapist", "therapist")
}

func createUsersFromService(client *PhysioClient, endpoint, model, label string) {
	query := fmt.Sprintf(`{"text":"select * from %s"}`, model)
	body, err := client.Get(endpoint, query)
	if err != nil {
		fmt.Printf("  ERROR fetching %ss: %v\n", label, err)
		return
	}
	var result map[string]interface{}
	if err := json.Unmarshal([]byte(body), &result); err != nil {
		fmt.Printf("  ERROR parsing %s response: %v\n", label, err)
		return
	}
	list, _ := result["list"].([]interface{})
	success, failed := 0, 0
	for _, item := range list {
		rec, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		email, _ := rec["email"].(string)
		if email == "" {
			continue
		}

		// Use clientId/therapistId as userId so ${userId} deny queries resolve correctly
		var userIdValue string
		var roleName string
		if label == "client" {
			userIdValue, _ = rec["clientId"].(string)
			roleName = "client"
		} else {
			userIdValue, _ = rec["therapistId"].(string)
			roleName = "admin"
		}
		if userIdValue == "" {
			userIdValue = email // fallback
		}

		userData := map[string]interface{}{
			"userId":        userIdValue,
			"fullName":      email,
			"email":         email,
			"password":      map[string]string{"hash": "admin"},
			"accountStatus": "ACCOUNT_STATUS_ACTIVE",
			"roles":         map[string]bool{roleName: true},
		}
		if _, err := client.Post("/physio/73/users", userData); err != nil {
			fmt.Printf("  FAIL %s: %s -> %v\n", label, email, err)
			failed++
		} else {
			success++
		}
	}
	fmt.Printf("  Created %d %s user accounts (%d failed)\n", success, label, failed)
}
