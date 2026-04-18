package main

import (
	"github.com/saichler/l8bus/go/overlay/vnic"
	"github.com/saichler/l8collector/go/collector/service"
	"github.com/saichler/l8pollaris/go/pollaris"
	"github.com/saichler/l8pollaris/go/pollaris/targets"
	"github.com/saichler/l8pollaris/go/types/l8tpollaris"
	"github.com/saichler/l8physio/go/physio/boostapp"
	"github.com/saichler/l8physio/go/physio/common"
	"github.com/saichler/l8types/go/ifs"
)

func main() {
	res := common.CreateResources("boostapp-collector", false)
	nic := vnic.NewVirtualNetworkInterface(res, nil)
	nic.Start()
	nic.WaitForConnection()

	// Activate pollaris and collector
	pollaris.Activate(nic)
	service.Activate(common.Boostapp_Links_ID, nic)

	// Register Boostapp poll configuration
	bootPolls := boostapp.CreateBoostappBootPolls()
	pollaris.Pollaris(nic.Resources()).Post(bootPolls, true)
	res.Logger().Info("Registered Boostapp poll config (15-minute cadence)")

	// Load credentials and post target
	_, email, password, branchID, err := res.Security().Credential("boostapp", "login", res)
	if err != nil {
		res.Logger().Error("Boostapp credentials not configured: ", err.Error())
		res.Logger().Info("Add credentials via System > Security > Credentials (NAME=boostapp, KEY=login)")
		common.WaitForSignal(res)
		return
	}

	// Inject branchId into the calendar poll body
	injectBranchId(bootPolls, branchID)

	target := boostapp.CreateBoostappTarget(email, password, branchID)
	nic.Resources().Registry().Register(&l8tpollaris.L8PTarget{})
	err = nic.Multicast(targets.ServiceName, targets.ServiceArea, ifs.POST, target)
	if err != nil {
		res.Logger().Error("Failed to post Boostapp target: ", err.Error())
	} else {
		res.Logger().Info("Boostapp target posted (branchId=", branchID, ")")
	}

	common.WaitForSignal(res)
}

func injectBranchId(p *l8tpollaris.L8Pollaris, branchID string) {
	if poll, ok := p.Polling["boostapp-calendar"]; ok {
		poll.What = poll.What[:len("POST::/ajax/CalendarView.php::")] +
			"fun=GetClassesByStudioByDate&branchId=" + branchID + "&" +
			"ClassesAll=1&MeetingsAll=1&Tasks=1&" +
			"Classes=&Meetings=&Locations=&Coaches=&ViewState=timeGridWeek&" +
			"SplitView=0&TypeOfView=1&extraParams=true&showAllCoaches=1&" +
			"showAllLocations=1&blockEvents=1&ScreenWidth=1657&zoomValue=2" +
			"::application/x-www-form-urlencoded; charset=UTF-8"
	}
}
