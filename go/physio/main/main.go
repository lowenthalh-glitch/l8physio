package main

import (
	"fmt"
	"github.com/saichler/l8bus/go/overlay/vnic"
	"github.com/saichler/l8physio/go/physio/aia"
	"github.com/saichler/l8physio/go/physio/common"
	"github.com/saichler/l8physio/go/physio/services"
	evtservices "github.com/saichler/l8events/go/services"
	"github.com/saichler/l8types/go/ifs"
	"os"
	"os/exec"
	"time"
)

func main() {
	res := common.CreateResources("PhysioServices", false)
	ifs.SetNetworkMode(ifs.NETWORK_K8s)
	nic := vnic.NewVirtualNetworkInterface(res, nil)
	nic.Start()
	nic.WaitForConnection()

	// Start postgres if running locally (no extra args = k8s, "local" arg = local dev)
	if len(os.Args) <= 1 {
		startDb(nic)
	}

	services.ActivateAllServices(common.DB_CREDS, common.DB_NAME, nic)
	aia.Activate(common.DB_CREDS, common.DB_NAME, nic)
	aia.ActivateChat(common.DB_CREDS, common.DB_NAME, nic)
	evtservices.ActivateEvents(common.DB_CREDS, common.DB_NAME, nic)

	common.WaitForSignal(res)
}

func startDb(nic ifs.IVNic) {
	_, user, pass, _, err := nic.Resources().Security().Credential(common.DB_CREDS, common.DB_NAME, nic.Resources())
	if err != nil {
		panic(common.DB_CREDS + " " + err.Error())
	}
	// When there is no security provider
	if user == "admin" && pass == "admin" {
		common.DB_NAME = "admin"
	}

	cmd := exec.Command("nohup", "/start-postgres.sh", common.DB_NAME, user, pass)
	out, err := cmd.Output()
	if err != nil {
		panic(err)
	}
	fmt.Println(string(out))
	time.Sleep(time.Second * 5)
}
