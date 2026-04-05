package services

import (
	"sync"

	"github.com/saichler/l8physio/go/physio/appointments"
	"github.com/saichler/l8physio/go/physio/clients"
	"github.com/saichler/l8physio/go/physio/exercises"
	"github.com/saichler/l8physio/go/physio/homefeedback"
	"github.com/saichler/l8physio/go/physio/plans"
	"github.com/saichler/l8physio/go/physio/progress"
	"github.com/saichler/l8physio/go/physio/protocols"
	"github.com/saichler/l8physio/go/physio/sessionreport"
	"github.com/saichler/l8physio/go/physio/therapists"
	"github.com/saichler/l8physio/go/physio/workout"
	"github.com/saichler/l8types/go/ifs"
)

const parallelWorkers = 10

func ActivateAllServices(creds, dbname string, vnic ifs.IVNic) {
	all := []func(){
		func() { clients.Activate(creds, dbname, vnic) },
		func() { exercises.Activate(creds, dbname, vnic) },
		func() { plans.Activate(creds, dbname, vnic) },
		func() { appointments.Activate(creds, dbname, vnic) },
		func() { progress.Activate(creds, dbname, vnic) },
		func() { protocols.Activate(creds, dbname, vnic) },
		func() { therapists.Activate(creds, dbname, vnic) },
		func() { workout.Activate(creds, dbname, vnic) },
		func() { sessionreport.Activate(creds, dbname, vnic) },
		func() { homefeedback.Activate(creds, dbname, vnic) },
	}

	sem := make(chan struct{}, parallelWorkers)
	var wg sync.WaitGroup

	for _, fn := range all {
		wg.Add(1)
		sem <- struct{}{}
		go func(f func()) {
			defer wg.Done()
			defer func() { <-sem }()
			f()
		}(fn)
	}
	wg.Wait()
}
