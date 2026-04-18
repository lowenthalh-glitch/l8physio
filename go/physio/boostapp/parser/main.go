package main

import (
	"github.com/saichler/l8bus/go/overlay/vnic"
	parserService "github.com/saichler/l8parser/go/parser/service"
	"github.com/saichler/l8pollaris/go/pollaris"
	"github.com/saichler/l8physio/go/physio/boostapp"
	"github.com/saichler/l8physio/go/physio/common"
	"github.com/saichler/l8physio/go/types/physio"
)

func main() {
	res := common.CreateResources("boostapp-parser", false)
	nic := vnic.NewVirtualNetworkInterface(res, nil)
	nic.Start()
	nic.WaitForConnection()

	// Register the Boostapp parsing rule
	parserService.RegisterRule(&boostapp.BoostappCalendarRule{})

	pollaris.Activate(nic)
	parserService.Activate(common.Boostapp_Links_ID, &physio.BoostappCalendarEvent{}, false, nic, "EventId")

	res.Logger().Info("Boostapp parser started")
	common.WaitForSignal(res)
}
