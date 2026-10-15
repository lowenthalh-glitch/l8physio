package boostapp

import (
	l8c "github.com/saichler/l8common/go/common"
	"github.com/lowenthalh-glitch/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
)

const (
	ServiceName = "BstpCal"
	ServiceArea = byte(50)
)

func Activate(creds, dbname string, vnic ifs.IVNic) {
	l8c.ActivateService(
		l8c.NewOrmSLA(ServiceName, ServiceArea, "EventId", newBstpCalServiceCallback(),
			&physio.BoostappCalendarEvent{}, &physio.BoostappCalendarEventList{}),
		creds, dbname, vnic)
}
