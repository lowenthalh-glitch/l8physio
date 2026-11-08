// Package testenv connects e2e tests to a running physio system.
package testenv

import (
	"os"
	"testing"

	"github.com/lowenthalh-glitch/l8physio/go/types/physio"
	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8types/go/ifs"
)

// EnvVar must be set (any non-empty value) for the e2e tests to run. They need
// a reachable VNet with the physio services activated, so they are skipped by default.
const EnvVar = "L8PHYSIO_E2E"

// NewVnic returns a vnic attached to the running overlay, or skips the test when
// e2e testing is not enabled. The vnic is shut down when the test ends.
func NewVnic(t *testing.T) ifs.IVNic {
	t.Helper()
	if os.Getenv(EnvVar) == "" {
		t.Skipf("set %s=1 to run e2e tests against a running physio system", EnvVar)
	}
	nic := l8c.CreateVnic("e2e-"+t.Name(), false, registerTypes)
	t.Cleanup(nic.Shutdown)
	return nic
}

func registerTypes(r ifs.IResources) {
	l8c.RegisterType(r, &physio.PhysioTherapist{}, &physio.PhysioTherapistList{}, "TherapistId")
	l8c.RegisterType(r, &physio.PhysioClient{}, &physio.PhysioClientList{}, "ClientId")
	l8c.RegisterType(r, &physio.PhysioExercise{}, &physio.PhysioExerciseList{}, "ExerciseId")
	l8c.RegisterType(r, &physio.PhysioProtocol{}, &physio.PhysioProtocolList{}, "ProtocolId")
	l8c.RegisterType(r, &physio.TreatmentPlan{}, &physio.TreatmentPlanList{}, "PlanId")
	l8c.RegisterType(r, &physio.Appointment{}, &physio.AppointmentList{}, "ApptId")
	l8c.RegisterType(r, &physio.ProgressLog{}, &physio.ProgressLogList{}, "LogId")
}
