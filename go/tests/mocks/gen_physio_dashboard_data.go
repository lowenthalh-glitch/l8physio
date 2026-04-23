package mocks

// Temporary mock data for HomeFeedback and SessionReport
// so the head therapist dashboard has data to display.

import (
	"math/rand"
	"time"

	lm "github.com/saichler/l8common/go/mocks"
	"github.com/saichler/l8physio/go/types/physio"
)

func generateHomeFeedbacks(store *MockDataStore) []*physio.HomeFeedback {
	if len(store.PhysioClientIDs) == 0 {
		return nil
	}
	now := time.Now()
	var feedbacks []*physio.HomeFeedback

	for i, clientId := range store.PhysioClientIDs {
		// 2-4 feedbacks per client over the last 2 weeks
		count := 2 + rand.Intn(3)
		for j := 0; j < count; j++ {
			daysAgo := j*3 + rand.Intn(2)
			date := now.AddDate(0, 0, -daysAgo)

			difficulty := physio.DifficultyLevel(1 + rand.Intn(4))       // 1-4
			painDuring := int32(rand.Intn(6))                             // 0-5
			painAfter := int32(rand.Intn(6))                              // 0-5
			sleep := int32(1 + rand.Intn(5))                              // 1-5
			nutrition := int32(1 + rand.Intn(5))                          // 1-5
			stress := int32(1 + rand.Intn(5))                             // 1-5

			// Compute status color (same logic as UI)
			d := int32(difficulty)
			var status physio.SessionStatus
			if d == 1 || d == 4 || painDuring >= 3 || painAfter >= 3 {
				status = physio.SessionStatus_SESSION_STATUS_RED
			} else if d == 2 || painDuring >= 1 || painAfter >= 1 {
				status = physio.SessionStatus_SESSION_STATUS_YELLOW
			} else {
				status = physio.SessionStatus_SESSION_STATUS_GREEN
			}

			therapistId := ""
			if len(store.PhysioTherapistIDs) > 0 {
				therapistId = store.PhysioTherapistIDs[i%len(store.PhysioTherapistIDs)]
			}

			feedbacks = append(feedbacks, &physio.HomeFeedback{
				FeedbackId:   lm.GenID("fb", i*10+j),
				ClientId:     clientId,
				TherapistId:  therapistId,
				FeedbackDate: date.Unix(),
				Difficulty:   difficulty,
				PainDuring:   painDuring,
				PainAfter:    painAfter,
				PainBefore:   sleep,
				Compliance:   physio.ComplianceLevel(nutrition),
				Mood:         physio.MoodLevel(stress),
				Status:       status,
				AuditInfo:    lm.CreateAuditInfo(),
			})
		}
	}
	return feedbacks
}

func generateSessionReports(store *MockDataStore) []*physio.SessionReport {
	if len(store.PhysioClientIDs) == 0 {
		return nil
	}
	now := time.Now()
	var reports []*physio.SessionReport

	for i, clientId := range store.PhysioClientIDs {
		// 1-3 session reports per client
		count := 1 + rand.Intn(3)
		for j := 0; j < count; j++ {
			daysAgo := j*5 + rand.Intn(3)
			date := now.AddDate(0, 0, -daysAgo)

			painBefore := int32(rand.Intn(6))
			painDuring := int32(rand.Intn(6))
			painAfter := int32(rand.Intn(6))
			hadDifficulty := rand.Intn(4) == 0
			adjustmentMade := rand.Intn(3) == 0

			var status physio.SessionStatus
			if painDuring >= 3 || painAfter >= 3 {
				status = physio.SessionStatus_SESSION_STATUS_RED
			} else if painDuring >= 1 || painAfter >= 1 || hadDifficulty {
				status = physio.SessionStatus_SESSION_STATUS_YELLOW
			} else {
				status = physio.SessionStatus_SESSION_STATUS_GREEN
			}

			therapistId := ""
			if len(store.PhysioTherapistIDs) > 0 {
				therapistId = store.PhysioTherapistIDs[i%len(store.PhysioTherapistIDs)]
			}

			adjustmentDetails := ""
			if adjustmentMade {
				details := []string{"Reduced load", "Changed exercise", "Added rest period", "Modified reps"}
				adjustmentDetails = details[rand.Intn(len(details))]
			}

			reports = append(reports, &physio.SessionReport{
				ReportId:          lm.GenID("rpt", i*10+j),
				ClientId:          clientId,
				TherapistId:       therapistId,
				SessionDate:       date.Unix(),
				PainBefore:        painBefore,
				PainDuring:        painDuring,
				PainAfter:         painAfter,
				HadDifficulty:     hadDifficulty,
				AdjustmentMade:    adjustmentMade,
				AdjustmentDetails: adjustmentDetails,
				Status:            status,
				AuditInfo:         lm.CreateAuditInfo(),
			})
		}
	}
	return reports
}
