package mocks

import (
	"fmt"

	lm "github.com/saichler/l8common/go/mocks"
	"github.com/saichler/l8physio/go/types/physio"
)

type therapistDef struct {
	firstName, lastName, specialization string
}

var therapistDefs = []therapistDef{
	{"Sarah", "Cohen", "Orthopedic Physiotherapy"},
	{"David", "Levy", "Sports Rehabilitation"},
	{"Maya", "Shapiro", "Neurological Physiotherapy"},
}

func generatePhysioTherapists() []*physio.PhysioTherapist {
	result := make([]*physio.PhysioTherapist, len(therapistDefs))
	for i, d := range therapistDefs {
		email := fmt.Sprintf("%s.%s@clinic.example.com", lm.SanitizeEmail(d.firstName), lm.SanitizeEmail(d.lastName))
		result[i] = &physio.PhysioTherapist{
			TherapistId:    lm.GenID("thr", i),
			FirstName:      d.firstName,
			LastName:       d.lastName,
			Email:          email,
			Phone:          lm.RandomPhone(),
			Specialization: d.specialization,
			LicenseNumber:  fmt.Sprintf("PT-%04d", i+1001),
			IsActive:       true,
			AuditInfo:      lm.CreateAuditInfo(),
		}
	}
	return result
}
