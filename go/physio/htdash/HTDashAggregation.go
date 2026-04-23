package htdash

import (
	"fmt"
	"sort"
	"strings"

	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

// computeDashboardRows queries ORM-backed services and aggregates into dashboard rows.
// Called by HTDashService.Get() — no ORM writes, pure in-memory computation.
func computeDashboardRows(vnic ifs.IVNic) []*physio.HeadThDashRow {
	// 1. Fetch all clients, filter active in Go
	allClients, err := l8c.GetEntities("PhyClient", ServiceArea, &physio.PhysioClient{}, vnic)
	if err != nil {
		fmt.Printf("  HTDash: fetch clients error: %v\n", err)
		return nil
	}
	var activeClients []*physio.PhysioClient
	for _, raw := range allClients {
		c := raw.(*physio.PhysioClient)
		if c.Status == physio.PhysioClientStatus_PHYSIO_CLIENT_STATUS_ACTIVE {
			activeClients = append(activeClients, c)
		}
	}

	// 2. Fetch all therapists for name lookup
	therapistMap := buildTherapistMap(vnic)

	// 3. Fetch all HomeFeedback — pick latest per client
	feedbackMap := buildLatestFeedbackMap(vnic)

	// 4. Fetch all SessionReports — pick latest per client
	reportMap := buildLatestReportMap(vnic)

	// 5. Fetch ExerciseSwapLog — counts + latest date per client
	swapCountMap, latestSwapDateMap := buildSwapMaps(vnic)

	// 6. Fetch latest override date per client
	latestOverrideDateMap := buildLatestOverrideDateMap(vnic)

	// 7. Build rows
	rows := make([]*physio.HeadThDashRow, 0, len(activeClients))
	for _, client := range activeClients {
		fb := feedbackMap[client.ClientId]
		rpt := reportMap[client.ClientId]

		overrideStatus := client.OverrideStatus

		// If override exists, check if a newer event has higher severity — if so, clear the override
		if overrideStatus > 0 {
			overrideDate := latestOverrideDateMap[client.ClientId]
			latestSeverity := physio.SessionStatus(0)
			latestEventDate := int64(0)

			if fb != nil && fb.FeedbackDate > latestEventDate {
				latestEventDate = fb.FeedbackDate
				latestSeverity = fb.Status
			}
			if rpt != nil && rpt.SessionDate > latestEventDate {
				latestEventDate = rpt.SessionDate
				latestSeverity = rpt.Status
			}
			// Exercise swaps are always YELLOW (severity 2)
			if swapDate, ok := latestSwapDateMap[client.ClientId]; ok && swapDate > latestEventDate {
				latestEventDate = swapDate
				latestSeverity = physio.SessionStatus_SESSION_STATUS_YELLOW
			}

			// If the latest event is AFTER the override AND has higher severity, clear override
			if latestEventDate > overrideDate && latestSeverity > overrideStatus {
				overrideStatus = 0
			}
		}

		row := &physio.HeadThDashRow{
			RowId:          client.ClientId,
			ClientId:       client.ClientId,
			ClientName:     client.FirstName + " " + client.LastName,
			TherapistId:    client.TherapistId,
			TherapistName:  therapistMap[client.TherapistId],
			OverrideStatus: overrideStatus,
			SwapCount:      swapCountMap[client.ClientId],
			StatusReason:   computeStatusReason(fb, rpt),
		}
		if fb != nil {
			row.LastFeedbackDate = fb.FeedbackDate
			row.LastFeedbackStatus = fb.Status
		}
		if rpt != nil {
			row.LastSessionDate = rpt.SessionDate
			row.LastSessionStatus = rpt.Status
		}
		rows = append(rows, row)
	}

	// Sort: overridden clients at bottom, then by highest severity (RED=3 first)
	sort.Slice(rows, func(i, j int) bool {
		iOverride := rows[i].OverrideStatus > 0
		jOverride := rows[j].OverrideStatus > 0
		// Override rows always sort after non-override rows
		if iOverride != jOverride {
			return !iOverride // non-override (false) before override (true)
		}
		// Within same group: highest severity first (RED=3 > YELLOW=2 > GREEN=1)
		iSev := effectiveSeverity(rows[i])
		jSev := effectiveSeverity(rows[j])
		return iSev > jSev
	})

	return rows
}

func effectiveSeverity(row *physio.HeadThDashRow) physio.SessionStatus {
	sev := row.LastFeedbackStatus
	if row.LastSessionStatus > sev {
		sev = row.LastSessionStatus
	}
	return sev
}

// computeStatusReason returns a human-readable string describing what's driving the color.
func computeStatusReason(fb *physio.HomeFeedback, rpt *physio.SessionReport) string {
	var reasons []string

	if fb != nil {
		switch fb.Difficulty {
		case 1:
			reasons = append(reasons, "Training: Easy, needs adjustment")
		case 4:
			reasons = append(reasons, "Training: Too difficult")
		case 2:
			reasons = append(reasons, "Training: Okay, needs adjustment")
		}
		if fb.PainDuring >= 3 {
			reasons = append(reasons, fmt.Sprintf("Pain during: %d/5", fb.PainDuring))
		}
		if fb.PainAfter >= 3 {
			reasons = append(reasons, fmt.Sprintf("Pain after: %d/5", fb.PainAfter))
		}
	}

	if rpt != nil {
		if rpt.AdjustmentMade {
			detail := rpt.AdjustmentDetails
			if detail == "" {
				detail = "yes"
			}
			reasons = append(reasons, "Adjustment: "+detail)
		}
		if rpt.HadDifficulty {
			reasons = append(reasons, "Difficulty reported")
		}
	}

	return strings.Join(reasons, ", ")
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

func buildSwapMaps(vnic ifs.IVNic) (map[string]int32, map[string]int64) {
	counts := map[string]int32{}
	dates := map[string]int64{}
	raw, err := l8c.GetEntities("ExSwapLog", ServiceArea, &physio.ExerciseSwapLog{}, vnic)
	if err != nil {
		return counts, dates
	}
	for _, r := range raw {
		swap := r.(*physio.ExerciseSwapLog)
		counts[swap.ClientId]++
		if swap.SwapDate > dates[swap.ClientId] {
			dates[swap.ClientId] = swap.SwapDate
		}
	}
	return counts, dates
}

func buildLatestOverrideDateMap(vnic ifs.IVNic) map[string]int64 {
	m := map[string]int64{}
	raw, err := l8c.GetEntities("OvrdLog", ServiceArea, &physio.StatusOverrideLog{}, vnic)
	if err != nil {
		return m
	}
	for _, r := range raw {
		ovrd := r.(*physio.StatusOverrideLog)
		if ovrd.ChangeDate > m[ovrd.ClientId] {
			m[ovrd.ClientId] = ovrd.ChangeDate
		}
	}
	return m
}
