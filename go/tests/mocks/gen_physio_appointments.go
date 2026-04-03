package mocks

import (
	"math/rand"

	lm "github.com/saichler/l8common/go/mocks"
	"github.com/saichler/l8physio/go/types/physio"
)

// generateAppointments creates 40 appointment records
// Status distribution: 30% Scheduled, 20% Confirmed, 35% Completed, 10% Cancelled, 5% No Show
func generateAppointments(store *MockDataStore) []*physio.Appointment {
	appointments := make([]*physio.Appointment, 40)

	for i := 0; i < 40; i++ {
		clientID := lm.PickRef(store.PhysioClientIDs, i)
		planID := lm.PickRef(store.TreatmentPlanIDs, i)

		var status physio.PhysioApptStatus
		switch {
		case i < 12:
			status = physio.PhysioApptStatus_PHYSIO_APPT_STATUS_SCHEDULED
		case i < 20:
			status = physio.PhysioApptStatus_PHYSIO_APPT_STATUS_CONFIRMED
		case i < 34:
			status = physio.PhysioApptStatus_PHYSIO_APPT_STATUS_COMPLETED
		case i < 38:
			status = physio.PhysioApptStatus_PHYSIO_APPT_STATUS_CANCELLED
		default:
			status = physio.PhysioApptStatus_PHYSIO_APPT_STATUS_NO_SHOW
		}

		// Future appointments for scheduled/confirmed, past for completed/cancelled/no-show
		var startTime int64
		if status == physio.PhysioApptStatus_PHYSIO_APPT_STATUS_SCHEDULED ||
			status == physio.PhysioApptStatus_PHYSIO_APPT_STATUS_CONFIRMED {
			startTime = lm.RandomFutureDate(2, 28)
		} else {
			startTime = lm.RandomPastDate(3, 28)
		}
		// 45-60 minute sessions
		duration := int64(rand.Intn(2)+1) * 15 * 60 // 15 or 30 minutes granularity
		endTime := startTime + 45*60 + duration

		therapistID := lm.PickRef(store.PhysioTherapistIDs, i)

		appointments[i] = &physio.Appointment{
			ApptId:         lm.GenID("appt", i),
			ClientId:       clientID,
			UserId:         "admin",
			PlanId:         planID,
			TherapistId:    therapistID,
			StartTime:      startTime,
			EndTime:        endTime,
			Status:         status,
			Location:       appointmentLocations[i%len(appointmentLocations)],
			TherapistNotes: "Session notes to be completed post-appointment.",
			AuditInfo:      lm.CreateAuditInfo(),
		}
	}

	return appointments
}
