package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync"

	"github.com/saichler/l8agent/go/types/l8agent"
	"github.com/saichler/l8common/go/common"
	l8c "github.com/saichler/l8common/go/common"
	"github.com/lowenthalh-glitch/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
	"github.com/saichler/l8types/go/types/l8events"
)

func main() {
	svr := common.CreateWebServer("web", registerPhysioTypes)
	http.HandleFunc("/index.html", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/", http.StatusMovedPermanently)
	})
	http.HandleFunc("/physio-auth", authProxy)
	svr.Start()
}

// Testing-only: lets clients log in with their cli-NNN alias instead of email.
// The login page POSTs {user, pass} to /physio-auth; if user is an alias
// (no '@'), we resolve it to the matching PhysioClient.client_id (email) and
// hand the rewritten body to the real /auth handler on the same ServeMux.
// Will be removed once the user drops the alias field from PhysioClient.

var (
	aliasDBOnce sync.Once
	aliasDB     *sql.DB
)

func openAliasDB() {
	defer func() { _ = recover() }() // OpenDBConection panics if postgres is unreachable
	aliasDB = common.OpenDBConection("admin", "admin", "admin", "5432")
}

func resolveAlias(alias string) string {
	aliasDBOnce.Do(openAliasDB)
	if aliasDB == nil {
		return ""
	}
	var clientID string
	if err := aliasDB.QueryRow(
		"SELECT clientid FROM physioclient WHERE alias=$1 AND clientid LIKE '%@%'",
		alias,
	).Scan(&clientID); err != nil {
		return ""
	}
	return clientID
}

func authProxy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	rewritten := body
	var req struct {
		User string `json:"user"`
		Pass string `json:"pass"`
	}
	if json.Unmarshal(body, &req) == nil && req.User != "" && !strings.Contains(req.User, "@") {
		if email := resolveAlias(req.User); email != "" {
			req.User = email
			if rb, jerr := json.Marshal(req); jerr == nil {
				rewritten = rb
			}
		}
	}
	inner, _ := http.NewRequestWithContext(r.Context(), http.MethodPost, "/auth", bytes.NewReader(rewritten))
	inner.Header = r.Header.Clone()
	inner.Header.Set("Content-Type", "application/json")
	inner.ContentLength = int64(len(rewritten))
	handler, pattern := http.DefaultServeMux.Handler(inner)
	if pattern == "" {
		http.Error(w, "/auth handler not registered", http.StatusInternalServerError)
		return
	}
	handler.ServeHTTP(w, inner)
}

/*
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

	resources := common.CreateResources("web-"+strconv.Itoa(port), false)

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
}*/

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

	// Exercise swap log + Status override log + Head therapist dashboard
	l8c.RegisterType(resources, &physio.ExerciseSwapLog{}, &physio.ExerciseSwapLogList{}, "SwapId")
	l8c.RegisterType(resources, &physio.StatusOverrideLog{}, &physio.StatusOverrideLogList{}, "OverrideId")
	l8c.RegisterType(resources, &physio.HeadThDashRow{}, &physio.HeadThDashRowList{}, "RowId")

	// Event types
	l8c.RegisterType(resources, &l8events.EventRecord{}, &l8events.EventRecordList{}, "EventId")
}
