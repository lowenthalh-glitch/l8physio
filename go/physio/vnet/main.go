package main

import (
	"github.com/saichler/l8bus/go/overlay/vnet"
	"github.com/saichler/l8physio/go/physio/common"
	"os"
)

func main() {
	resources := common.CreateResources("vnet-" + os.Getenv("HOSTNAME"), false)
	net := vnet.NewVNet(resources)
	net.Start()
	resources.Logger().Info("physio vnet started!")
	common.WaitForSignal(resources)
}
