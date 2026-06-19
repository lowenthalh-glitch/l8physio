package main

import (
	"fmt"
	"os"

	"github.com/lowenthalh-glitch/l8physio/go/physio/common"

	"github.com/saichler/l8bus/go/overlay/vnic"
	"github.com/saichler/l8logfusion/go/agent/logs"
	"github.com/saichler/l8logfusion/go/types/l8logf"
	"github.com/saichler/l8utils/go/utils/ipsegment"
)

func main() {

	ip := os.Getenv("NODE_IP")
	if ip == "" {
		fmt.Println("Env variable NODE_IP is not set, using machine ip")
		ip = ipsegment.MachineIP
	}

	r := common.CreateResources("logagent", true)
	r.SysConfig().RemoteVnet = ip

	logsDirectory := r.SysConfig().LogConfig.LogDirectory

	logpath := os.Getenv("LOGPATH")
	if logpath == "" {
		fmt.Println("Env variable LOGPATH is not set, using " + logsDirectory)
		logpath = logsDirectory
	}

	logfile := os.Getenv("LOGFILE")
	if logfile == "" {
		fmt.Println("Env variable LOGFILE is not set, using *")
		logfile = "*"
	}

	nic := vnic.NewVirtualNetworkInterface(r, nil)
	nic.Start()
	nic.WaitForConnection()

	lc := &l8logf.L8LogConfig{Path: logpath, Name: logfile}
	collector := logs.NewLogCollector(lc, nic)
	collector.Collect()
}
