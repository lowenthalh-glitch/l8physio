package main

import (
	"time"

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
	targets.Links = &common.BoostappLinks{}
	res := common.CreateResources("boostapp-collector", false)
	nic := vnic.NewVirtualNetworkInterface(res, nil)
	nic.Start()
	nic.WaitForConnection()

	// Load credentials first — needed to inject branchId into poll config
	_, email, password, branchID, err := res.Security().Credential("boostapp", "login", res)
	if err != nil {
		res.Logger().Error("Boostapp credentials not configured: ", err.Error())
		res.Logger().Info("Add credentials via System > Security > Credentials (NAME=boostapp, KEY=login)")
		common.WaitForSignal(res)
		return
	}

	// Build poll config with branchId injected BEFORE registering
	bootPolls := boostapp.CreateBoostappBootPolls(branchID)

	// Activate pollaris, targets service, and collector
	pollaris.Activate(nic)
	pollaris.Pollaris(nic.Resources()).Post(bootPolls, true)
	res.Logger().Info("Registered Boostapp poll config (15-minute cadence, branchId=", branchID, ")")

	targets.Activate(common.DB_CREDS, common.DB_NAME, nic)
	service.Activate(common.Boostapp_Links_ID, nic)

	// Wait for services to be fully wired before posting the target
	time.Sleep(2 * time.Second)

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
