package main

import (
	"os"

	"github.com/saichler/l8logfusion/go/agent/logagent"
	"github.com/saichler/l8types/go/ifs"
	shared "github.com/saichler/l8utils/go/utils/shared"
)

func main() {
	nodeIP := os.Getenv("NODE_IP")
	logPath := os.Getenv("LOGPATH")
	logFile := os.Getenv("LOGFILE")
	if logPath == "" {
		logPath = "/data/logs/physio"
	}

	resources := shared.ResourcesOf("logs", 0, 30)
	resources.Logger().Info("physio log-agent starting, nodeIP=" + nodeIP + ", logPath=" + logPath)
	logagent.StartAgent(nodeIP, logPath, logFile, resources, ifs.LogLevel_Info)
}
