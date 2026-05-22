package mocks

import (
	"encoding/json"
	"fmt"

	"github.com/saichler/l8physio/go/types/physio"
)

// RunAllPhases executes all physio data phases in dependency order.
// PhysioClients are NOT seeded here — they're auto-onboarded by the Boostapp sync
// (boostapp_demo's autoOnboardUnlinked). Client-dependent phases fetch the live
// client list back from the service and skip themselves if it's empty.
func RunAllPhases(client *PhysioClient, store *MockDataStore) {
	runPhysioPhase1(client, store) // Therapists & Exercises (no dependencies)
	runPhysioPhase5(client, store) // Protocols (needs exercises)

	clientIds := fetchClientIDs(client)
	if len(clientIds) == 0 {
		fmt.Printf("=== Skipping client-dependent phases: no clients in service ===\n")
	} else {
		runPhysioPhase2(client, store, clientIds)        // Treatment Plans
		runPhysioPhase3(client, store, clientIds)        // Appointments
		runPhysioPhase4(client, store, clientIds)        // Progress Logs
		runPhysioDashboardData(client, store, clientIds) // HomeFeedback + SessionReport
	}

	runPhysioPhase6(client, store) // Create therapist user accounts (clients get users from Boostapp sync)
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

	// Classified exercises from client's rehab protocol builder (full joint/posture/phase classification)
	rehabExercises := generateRehabBankExercises()
	// Client exercises (manually curated from protocols.xlsx with full classification)
	clientExercises := generateClientExercises()
	// Combine all classified exercises and link progression/regression chains
	allExercises := append(rehabExercises, clientExercises...)
	linkProgressionRegression(allExercises)

	_, err = client.Post("/physio/50/PhyExercis", &physio.PhysioExerciseList{List: allExercises})
	if err != nil {
		fmt.Printf("  ERROR creating exercises: %v\n", err)
	} else {
		storeExercises(allExercises, store)
		fmt.Printf("  Created %d exercises (with progression/regression links)\n", len(allExercises))
	}
}

// runPhysioPhase2 generates treatment plans (requires clients and exercises)
func runPhysioPhase2(client *PhysioClient, store *MockDataStore, clientIds []string) {
	fmt.Printf("=== Phase 2: Treatment Plans ===\n")

	if len(store.PhysioExerciseIDs) == 0 {
		fmt.Printf("  SKIPPED: no exercises available (Phase 1 may have failed)\n")
		return
	}

	plans := generateTreatmentPlans(store, clientIds)
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
func runPhysioPhase3(client *PhysioClient, store *MockDataStore, clientIds []string) {
	fmt.Printf("=== Phase 3: Appointments ===\n")

	if len(store.TreatmentPlanIDs) == 0 {
		fmt.Printf("  SKIPPED: no plans available (Phase 2 may have failed)\n")
		return
	}

	appointments := generateAppointments(store, clientIds)
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
func runPhysioPhase4(client *PhysioClient, store *MockDataStore, clientIds []string) {
	fmt.Printf("=== Phase 4: Progress Logs ===\n")

	if len(store.PhysioExerciseIDs) == 0 || len(store.TreatmentPlanIDs) == 0 || len(store.AppointmentIDs) == 0 {
		fmt.Printf("  SKIPPED: missing exercises, plans, or appointments (earlier phase may have failed)\n")
		return
	}

	logs := generateProgressLogs(store, clientIds)
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

// runPhysioDashboardData creates HomeFeedback and SessionReport records for the dashboard.
// Clients are sourced from the Boostapp sync; RunAllPhases passes the fetched clientIds in.
func runPhysioDashboardData(client *PhysioClient, store *MockDataStore, clientIds []string) {
	fmt.Printf("=== Dashboard Data: HomeFeedback + SessionReport ===\n")

	feedbacks := generateHomeFeedbacks(clientIds, store.PhysioTherapistIDs)
	if len(feedbacks) > 0 {
		_, err := client.Post("/physio/50/HomeFdbk", &physio.HomeFeedbackList{List: feedbacks})
		if err != nil {
			fmt.Printf("  ERROR creating HomeFeedbacks: %v\n", err)
		} else {
			fmt.Printf("  Created %d HomeFeedbacks\n", len(feedbacks))
		}
	}

	reports := generateSessionReports(clientIds, store.PhysioTherapistIDs)
	if len(reports) > 0 {
		_, err := client.Post("/physio/50/SessRpt", &physio.SessionReportList{List: reports})
		if err != nil {
			fmt.Printf("  ERROR creating SessionReports: %v\n", err)
		} else {
			fmt.Printf("  Created %d SessionReports\n", len(reports))
		}
	}
}

// fetchClientIDs returns the clientId of every PhysioClient currently in the service.
func fetchClientIDs(client *PhysioClient) []string {
	body, err := client.Get("/physio/50/PhyClient", `{"text":"select * from PhysioClient"}`)
	if err != nil {
		fmt.Printf("  ERROR fetching clients: %v\n", err)
		return nil
	}
	var result map[string]interface{}
	if err := json.Unmarshal([]byte(body), &result); err != nil {
		fmt.Printf("  ERROR parsing clients response: %v\n", err)
		return nil
	}
	list, _ := result["list"].([]interface{})
	ids := make([]string, 0, len(list))
	for _, item := range list {
		rec, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		if id, _ := rec["clientId"].(string); id != "" {
			ids = append(ids, id)
		}
	}
	return ids
}

// runPhysioPhase6 creates login accounts for therapists.
// Clients get users from the Boostapp sync (autoOnboardUnlinked).
func runPhysioPhase6(client *PhysioClient, store *MockDataStore) {
	fmt.Printf("=== Phase 6: User Logins ===\n")

	body, err := client.Get("/physio/50/PhyTherapt", `{"text":"select * from PhysioTherapist"}`)
	if err != nil {
		fmt.Printf("  ERROR fetching therapists: %v\n", err)
		return
	}
	var result map[string]interface{}
	if err := json.Unmarshal([]byte(body), &result); err != nil {
		fmt.Printf("  ERROR parsing therapist response: %v\n", err)
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

		// userId must match the ID field used in deny-scope rules (${userId})
		// email field enables login by email via l8secure email login
		userIdValue, _ := rec["therapistId"].(string)
		if userIdValue == "" {
			userIdValue = email
		}

		fullName := ""
		if fn, _ := rec["firstName"].(string); fn != "" {
			fullName = fn
			if ln, _ := rec["lastName"].(string); ln != "" {
				fullName += " " + ln
			}
		}
		if fullName == "" {
			fullName = email
		}

		userData := map[string]interface{}{
			"userId":        userIdValue,
			"fullName":      fullName,
			"email":         email,
			"portal":        "therapist-app.html",
			"password":      map[string]string{"hash": "12345678"},
			"accountStatus": "ACCOUNT_STATUS_ACTIVE",
			"roles":         map[string]bool{"therapist": true},
		}
		if _, err := client.Post("/physio/73/users", userData); err != nil {
			fmt.Printf("  FAIL therapist: %s -> %v\n", email, err)
			failed++
		} else {
			success++
		}
	}
	fmt.Printf("  Created %d therapist user accounts (%d failed)\n", success, failed)
}
