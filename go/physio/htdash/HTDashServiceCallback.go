package htdash

import (
	"errors"
	"fmt"
	"sync"

	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

// htDashCallback implements IServiceCallback directly to control the Before return.
// POST: runs refresh, returns continue=false (prevents dummy trigger row from being stored).
// GET: pure read, returns continue=true.
// PUT/DELETE: rejected.
type htDashCallback struct {
	vnic       ifs.IVNic
	mu         sync.Mutex
	refreshing bool
}

func newHTDashServiceCallback(vnic ifs.IVNic) ifs.IServiceCallback {
	return &htDashCallback{vnic: vnic}
}

func (cb *htDashCallback) Before(any interface{}, action ifs.Action, cont bool, vnic ifs.IVNic) (interface{}, bool, error) {
	if _, ok := any.(*physio.HeadThDashRow); !ok {
		return nil, false, errors.New("invalid HeadThDashRow type")
	}

	switch action {
	case ifs.POST:
		// Guard: internal POSTs from refresh pass through for persistence
		cb.mu.Lock()
		if cb.refreshing {
			cb.mu.Unlock()
			row := any.(*physio.HeadThDashRow)
			if row.RowId == "" {
				l8c.GenerateID(&row.RowId)
			}
			return any, true, nil
		}
		cb.refreshing = true
		cb.mu.Unlock()

		defer func() {
			cb.mu.Lock()
			cb.refreshing = false
			cb.mu.Unlock()
		}()

		// External POST = refresh trigger
		err := refreshDashboard(cb.vnic)
		if err != nil {
			return nil, false, fmt.Errorf("refresh failed: %w", err)
		}
		// Abort the trigger POST — refresh already wrote the real rows
		return nil, false, nil

	case ifs.GET:
		return any, true, nil

	default:
		return nil, false, errors.New("HTDash is read-only (use POST to refresh)")
	}
}

func (cb *htDashCallback) After(any interface{}, action ifs.Action, cont bool, vnic ifs.IVNic) (interface{}, bool, error) {
	return any, true, nil
}

func refreshDashboard(vnic ifs.IVNic) error {
	// 1. Fetch all clients, filter active in Go
	allClients, err := l8c.GetEntities("PhyClient", ServiceArea, &physio.PhysioClient{}, vnic)
	if err != nil {
		return fmt.Errorf("fetch clients: %w", err)
	}
	var clientsRaw []interface{}
	for _, raw := range allClients {
		c := raw.(*physio.PhysioClient)
		if c.Status == physio.PhysioClientStatus_PHYSIO_CLIENT_STATUS_ACTIVE {
			clientsRaw = append(clientsRaw, raw)
		}
	}
	fmt.Printf("  HTDash refresh: %d active clients (of %d total)\n", len(clientsRaw), len(allClients))

	// 2. Fetch all therapists for name lookup
	therapistMap := buildTherapistMap(vnic)

	// 3. Fetch all HomeFeedback — pick latest per client
	feedbackMap := buildLatestFeedbackMap(vnic)

	// 4. Fetch all SessionReports — pick latest per client
	reportMap := buildLatestReportMap(vnic)

	// 5. Fetch ExerciseSwapLog counts per client
	swapCountMap := buildSwapCountMap(vnic)

	// 6. Build and store a row per client (RowId=clientId for upsert)
	for _, raw := range clientsRaw {
		client := raw.(*physio.PhysioClient)
		// Default enum values to GREEN (1) to avoid ORM panic on zero-value enums
		// This is a workaround for an ORM bug where zero-value enums cause "Value is invalid"
		feedbackStatus := physio.SessionStatus_SESSION_STATUS_GREEN
		sessionStatus := physio.SessionStatus_SESSION_STATUS_GREEN
		overrideStatus := client.OverrideStatus
		if overrideStatus == 0 {
			overrideStatus = physio.SessionStatus_SESSION_STATUS_GREEN
		}

		var lastFeedbackDate int64
		var lastSessionDate int64

		if fb, ok := feedbackMap[client.ClientId]; ok {
			lastFeedbackDate = fb.FeedbackDate
			feedbackStatus = fb.Status
			if feedbackStatus == 0 {
				feedbackStatus = physio.SessionStatus_SESSION_STATUS_GREEN
			}
		}
		if rpt, ok := reportMap[client.ClientId]; ok {
			lastSessionDate = rpt.SessionDate
			sessionStatus = rpt.Status
			if sessionStatus == 0 {
				sessionStatus = physio.SessionStatus_SESSION_STATUS_GREEN
			}
		}

		row := &physio.HeadThDashRow{
			RowId:              client.ClientId,
			ClientId:           client.ClientId,
			ClientName:         client.FirstName + " " + client.LastName,
			TherapistId:        client.TherapistId,
			TherapistName:      therapistMap[client.TherapistId],
			LastFeedbackDate:   lastFeedbackDate,
			LastFeedbackStatus: feedbackStatus,
			LastSessionDate:    lastSessionDate,
			LastSessionStatus:  sessionStatus,
			OverrideStatus:     overrideStatus,
			SwapCount:          swapCountMap[client.ClientId],
		}
		// Try PUT first (update existing), fall back to POST (create new)
		putErr := l8c.PutEntity(ServiceName, ServiceArea, row, vnic)
		if putErr != nil {
			_, postErr := l8c.PostEntity(ServiceName, ServiceArea, row, vnic)
			if postErr != nil {
				fmt.Printf("  HTDash: failed to store row for %s: %v\n", client.ClientId, postErr)
			}
		}
	}

	return nil
}

func buildTherapistMap(vnic ifs.IVNic) map[string]string {
	m := map[string]string{}
	raw, err := l8c.GetEntities("PhyTherapt", ServiceArea, &physio.PhysioTherapist{}, vnic)
	if err != nil {
		return m
	}
	for _, r := range raw {
		t := r.(*physio.PhysioTherapist)
		m[t.TherapistId] = t.FirstName + " " + t.LastName
	}
	return m
}

func buildLatestFeedbackMap(vnic ifs.IVNic) map[string]*physio.HomeFeedback {
	m := map[string]*physio.HomeFeedback{}
	raw, err := l8c.GetEntities("HomeFdbk", ServiceArea, &physio.HomeFeedback{}, vnic)
	if err != nil {
		return m
	}
	for _, r := range raw {
		fb := r.(*physio.HomeFeedback)
		if existing, ok := m[fb.ClientId]; !ok || fb.FeedbackDate > existing.FeedbackDate {
			m[fb.ClientId] = fb
		}
	}
	return m
}

func buildLatestReportMap(vnic ifs.IVNic) map[string]*physio.SessionReport {
	m := map[string]*physio.SessionReport{}
	raw, err := l8c.GetEntities("SessRpt", ServiceArea, &physio.SessionReport{}, vnic)
	if err != nil {
		return m
	}
	for _, r := range raw {
		rpt := r.(*physio.SessionReport)
		if existing, ok := m[rpt.ClientId]; !ok || rpt.SessionDate > existing.SessionDate {
			m[rpt.ClientId] = rpt
		}
	}
	return m
}

func buildSwapCountMap(vnic ifs.IVNic) map[string]int32 {
	m := map[string]int32{}
	raw, err := l8c.GetEntities("ExSwapLog", ServiceArea, &physio.ExerciseSwapLog{}, vnic)
	if err != nil {
		return m
	}
	for _, r := range raw {
		swap := r.(*physio.ExerciseSwapLog)
		m[swap.ClientId]++
	}
	return m
}
