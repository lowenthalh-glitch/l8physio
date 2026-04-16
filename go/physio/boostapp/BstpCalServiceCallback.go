package boostapp

import (
	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

func newBstpCalServiceCallback() ifs.IServiceCallback {
	return l8c.NewServiceCallback(
		"BoostappCalendarEvent",
		func(e interface{}) bool { _, ok := e.(*physio.BoostappCalendarEvent); return ok },
		setBstpCalID,
		validateBstpCal,
	)
}

func setBstpCalID(e interface{}) {
	entity := e.(*physio.BoostappCalendarEvent)
	// Events arrive with their Boostapp ID already set; only generate if missing
	if entity.EventId == "" {
		l8c.GenerateID(&entity.EventId)
	}
}

func validateBstpCal(e interface{}, vnic ifs.IVNic) error {
	entity := e.(*physio.BoostappCalendarEvent)
	if err := l8c.ValidateRequired(entity.Title, "Title"); err != nil {
		return err
	}
	return nil
}
