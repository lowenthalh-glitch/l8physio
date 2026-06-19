package main

import (
	"github.com/saichler/l8bus/go/overlay/vnet"
	"github.com/saichler/l8logfusion/go/agent/logserver"
	"github.com/lowenthalh-glitch/l8physio/go/physio/common"
)

func main() {
	logsDbDirectory := "/data/logsdb/physio"
	resources := common.CreateResources("log-vnet", false)
	resources.SysConfig().VnetPort = resources.SysConfig().LogConfig.VnetPort
	net := vnet.NewVNet(resources, true)
	net.Start()
	logserver.ActivateLogService(logsDbDirectory, net.VnetVnic())
	resources.Logger().Info("physio logs vnet started!")
	common.WaitForSignal(resources)
}
