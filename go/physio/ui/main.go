package main

import (
	"github.com/saichler/l8bus/go/overlay/vnic"
	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8agent/go/types/l8agent"
	"github.com/saichler/l8events/go/types/l8events"
	"github.com/saichler/l8physio/go/physio/aia"
	"github.com/saichler/l8physio/go/physio/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8services/go/services/csvexport"
	"github.com/saichler/l8services/go/services/filestore"
	"github.com/saichler/l8types/go/ifs"
	"github.com/saichler/l8utils/go/utils/ipsegment"
	"github.com/saichler/l8web/go/web/server"
	"strconv"
)

func main() {
	startWebServer(2774, "/data/physio")
}

func startWebServer(port int, cert string) {
	serverConfig := &server.RestServerConfig{
		Host:           ipsegment.MachineIP,
		Port:           port,
		Authentication: true,
		CertName:       cert,
		Prefix:         common.PREFIX,
	}
	svr, err := server.NewRestServer(serverConfig)
	if err != nil {
		panic(err)
	}

	resources := common.CreateResources("web-" + strconv.Itoa(port), false)

	registerPhysioTypes(resources)

	nic := vnic.NewVirtualNetworkInterface(resources, nil)
	nic.Resources().SysConfig().KeepAliveIntervalSeconds = 60
	nic.Start()
	nic.WaitForConnection()

	aia.Activate(common.DB_CREDS, common.DB_NAME, nic)

	csvexport.Activate(nic)
	filestore.Activate(nic)

	sla := ifs.NewServiceLevelAgreement(&server.WebService{}, ifs.WebService, 0, false, nil)
	sla.SetArgs(svr)
	nic.Resources().Services().Activate(sla, nic)

	nic.Resources().Logger().Info("Physio Web Server Started!")
	svr.Start()
}

func registerPhysioTypes(resources ifs.IResources) {
	// Agent types
	l8c.RegisterType(resources, &l8agent.L8AgentConversation{}, &l8agent.L8AgentConversationList{}, "ConversationId")
	l8c.RegisterType(resources, &l8agent.L8AgentChatMessage{}, &l8agent.L8AgentChatMessageList{}, "ConversationId")
	l8c.RegisterType(resources, &l8agent.L8AgentChatConversation{}, &l8agent.L8AgentChatConversationList{}, "ConversationId")
	l8c.RegisterType(resources, &l8agent.L8AgentPrompt{}, &l8agent.L8AgentPromptList{}, "PromptId")

	// Physio types
	l8c.RegisterType(resources, &physio.PhysioTherapist{}, &physio.PhysioTherapistList{}, "TherapistId")
	l8c.RegisterType(resources, &physio.PhysioClient{}, &physio.PhysioClientList{}, "ClientId")
	l8c.RegisterType(resources, &physio.PhysioExercise{}, &physio.PhysioExerciseList{}, "ExerciseId")
	l8c.RegisterType(resources, &physio.TreatmentPlan{}, &physio.TreatmentPlanList{}, "PlanId")
	l8c.RegisterType(resources, &physio.Appointment{}, &physio.AppointmentList{}, "ApptId")
	l8c.RegisterType(resources, &physio.ProgressLog{}, &physio.ProgressLogList{}, "LogId")
	l8c.RegisterType(resources, &physio.PhysioProtocol{}, &physio.PhysioProtocolList{}, "ProtocolId")
	l8c.RegisterType(resources, &physio.GeneratedWorkout{}, &physio.GeneratedWorkoutList{}, "WorkoutId")
	l8c.RegisterType(resources, &physio.SessionReport{}, &physio.SessionReportList{}, "ReportId")
	l8c.RegisterType(resources, &physio.HomeFeedback{}, &physio.HomeFeedbackList{}, "FeedbackId")

	// Boostapp calendar sync
	l8c.RegisterType(resources, &physio.BoostappCalendarEvent{}, &physio.BoostappCalendarEventList{}, "EventId")

	// Event types
	l8c.RegisterType(resources, &l8events.EventRecord{}, &l8events.EventRecordList{}, "EventId")
}
