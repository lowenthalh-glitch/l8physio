package main

import (
	"github.com/saichler/l8bus/go/overlay/vnic"
	erpc "github.com/saichler/l8erp/go/erp/common"
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

	resources := common.CreateResources("web-" + strconv.Itoa(port))
	resources.SysConfig().VnetPort = common.PHYSIO_VNET

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
	erpc.RegisterType[physio.PhysioTherapist, physio.PhysioTherapistList](resources, "TherapistId")
	erpc.RegisterType[physio.PhysioClient, physio.PhysioClientList](resources, "ClientId")
	erpc.RegisterType[physio.PhysioExercise, physio.PhysioExerciseList](resources, "ExerciseId")
	erpc.RegisterType[physio.TreatmentPlan, physio.TreatmentPlanList](resources, "PlanId")
	erpc.RegisterType[physio.Appointment, physio.AppointmentList](resources, "ApptId")
	erpc.RegisterType[physio.ProgressLog, physio.ProgressLogList](resources, "LogId")
	erpc.RegisterType[physio.PhysioProtocol, physio.PhysioProtocolList](resources, "ProtocolId")
	erpc.RegisterType[physio.GeneratedWorkout, physio.GeneratedWorkoutList](resources, "WorkoutId")
}
