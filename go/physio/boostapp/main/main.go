package main

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/saichler/l8bus/go/overlay/vnic"
	l8c "github.com/saichler/l8common/go/common"
	"github.com/saichler/l8physio/go/physio/boostapp"
	"github.com/saichler/l8physio/go/physio/common"
	"github.com/saichler/l8physio/go/types/physio"
	"github.com/saichler/l8types/go/ifs"
	"google.golang.org/protobuf/encoding/protojson"
)

func main() {
	// Standalone mode: ./boostapp_demo --fetch <email> <password> <branchId>
	// Fetches Boostapp calendar and prints results — no vnet/security needed.
	if len(os.Args) >= 5 && os.Args[1] == "--fetch" {
		standaloneSync(os.Args[2], os.Args[3], os.Args[4])
		return
	}

	// Push mode: ./boostapp_demo --push <email> <password> <branchId> <serverURL> <username> <password>
	// Fetches from Boostapp and POSTs events to the running physio web server via HTTP.
	// Example: ./boostapp_demo --push lowenthalh@gmail.com n5dqgc 15203 https://192.168.134.128:2774 admin admin
	if len(os.Args) >= 8 && os.Args[1] == "--push" {
		pushSync(os.Args[2], os.Args[3], os.Args[4], os.Args[5], os.Args[6], os.Args[7])
		return
	}

	// Connected mode: requires vnet + security plugin
	log("=== Boostapp Sync Starting ===")
	log("Creating resources...")
	res := common.CreateResources("boostapp-sync", false)
	log("Resources created OK")
	log("Connecting to vnet...")
	nic := vnic.NewVirtualNetworkInterface(res, nil)
	nic.Start()
	nic.WaitForConnection()
	log("Connected to vnet")

	log("Activating BstpCal service...")
	boostapp.Activate(common.DB_CREDS, common.DB_NAME, nic)
	log("BstpCal service activated")

	log("Loading Boostapp credentials from security plugin...")
	email, password, branchID, err := loadCredentials(res)
	if err != nil {
		log("ERROR: Boostapp credentials not configured: " + err.Error())
		log("Add credentials via System > Security > Credentials (NAME=boostapp, KEY=login)")
		common.WaitForSignal(res)
		return
	}
	log("Credentials loaded (email=" + email + ", branchId=" + branchID + ")")

	log("Logging in to Boostapp...")
	client := boostapp.NewClient(email, password, branchID)
	if err := client.Login(); err != nil {
		log("ERROR: Boostapp login failed: " + err.Error())
		common.WaitForSignal(res)
		return
	}
	log("Boostapp login successful")

	// --once flag: sync once and exit
	if len(os.Args) > 1 && os.Args[1] == "--once" {
		syncOnce(client, nic, res)
		return
	}

	interval := syncInterval()
	log("Sync interval: " + strconv.Itoa(int(interval.Minutes())) + " minutes")
	runSyncLoop(client, nic, res, interval)
}

// standaloneSync fetches from Boostapp and prints results to stdout.
// No vnet, no security plugin, no database — just HTTP to Boostapp.
func standaloneSync(email, password, branchID string) {
	log("=== Standalone Fetch Mode ===")
	log("Email: " + email)
	log("Branch: " + branchID)

	log("Logging in to Boostapp...")
	client := boostapp.NewClient(email, password, branchID)
	if err := client.Login(); err != nil {
		log("ERROR: Login failed: " + err.Error())
		os.Exit(1)
	}
	log("Login successful")

	start, end := syncDateRange()
	log("Fetching calendar: " + start + " to " + end)

	resp, err := client.FetchCalendar(start, end)
	if err != nil {
		log("ERROR: Fetch failed: " + err.Error())
		os.Exit(1)
	}

	events := boostapp.ConvertAll(resp)
	log(fmt.Sprintf("Fetched %d events", len(events)))
	log("")

	// Fetch participants for class events (type 3) and meeting events that don't already have client info
	log("Fetching participants for events...")
	fetchParticipantsForEvents(client, events)
	log("")

	for i, e := range events {
		typeName := "?"
		switch e.EventType {
		case physio.BoostappEventType_BOOSTAPP_EVENT_TYPE_MEETING:
			typeName = "Meeting"
		case physio.BoostappEventType_BOOSTAPP_EVENT_TYPE_CLASS:
			typeName = "Class"
		case physio.BoostappEventType_BOOSTAPP_EVENT_TYPE_BLOCK:
			typeName = "Block"
		}
		clientInfo := ""
		if e.ClientName != "" {
			clientInfo = " | Client: " + e.ClientName
			if e.ClientPhone != "" {
				clientInfo += " (" + e.ClientPhone + ")"
			}
		}
		log(fmt.Sprintf("  %2d. [%s] %s | %s - %s | Coach: %s | Location: %s%s",
			i+1, typeName, e.Title, e.StartTime, e.EndTime, e.CoachName, e.Location, clientInfo))

		if len(e.Participants) > 0 {
			log(fmt.Sprintf("      Participants (%d):", len(e.Participants)))
			for _, p := range e.Participants {
				log(fmt.Sprintf("        - %s (ClientId=%s, Status=%s, Membership=%s)",
					p.Name, p.BoostappClientId, p.Status, p.Membership))
			}
		}
	}

	log("")
	log("Raw JSON of first event:")
	if len(events) > 0 {
		b, _ := json.MarshalIndent(events[0], "  ", "  ")
		println("  " + string(b))
	}
}

// pushSync logs in to Boostapp, fetches events + participants, and POSTs them to the
// running physio web server via HTTP (no vnet required).
func pushSync(email, password, branchID, serverURL, adminUser, adminPass string) {
	log("=== Push Sync Mode ===")
	log("Server: " + serverURL)

	// 1. Authenticate with the physio web server to get a bearer token
	log("Authenticating with physio server...")
	token, err := loginToPhysio(serverURL, adminUser, adminPass)
	if err != nil {
		log("ERROR: physio auth failed: " + err.Error())
		os.Exit(1)
	}
	log("Authenticated OK")

	// 2. Log in to Boostapp
	log("Logging in to Boostapp...")
	bsClient := boostapp.NewClient(email, password, branchID)
	if err := bsClient.Login(); err != nil {
		log("ERROR: Boostapp login failed: " + err.Error())
		os.Exit(1)
	}
	log("Boostapp login OK")

	// 3. Fetch events
	start, end := syncDateRange()
	log("Fetching calendar: " + start + " to " + end)
	resp, err := bsClient.FetchCalendar(start, end)
	if err != nil {
		log("ERROR: Boostapp fetch failed: " + err.Error())
		os.Exit(1)
	}
	events := boostapp.ConvertAll(resp)
	log(fmt.Sprintf("Fetched %d events", len(events)))

	// 4. Fetch participants for class events
	log("Fetching participants...")
	fetchParticipantsForEvents(bsClient, events)

	// 5. POST each event to the physio server
	log("Posting events to physio server...")
	posted, failed := 0, 0
	for _, e := range events {
		if err := postEventToPhysio(serverURL, token, e); err != nil {
			failed++
			log("  FAIL " + e.EventId + " (" + e.Title + "): " + err.Error())
		} else {
			posted++
		}
	}
	log(fmt.Sprintf("Done: %d posted, %d failed, %d total", posted, failed, len(events)))
}

// loginToPhysio authenticates with the physio web server and returns a bearer token.
func loginToPhysio(serverURL, user, pass string) (string, error) {
	payload := fmt.Sprintf(`{"user":"%s","pass":"%s"}`, user, pass)
	req, _ := http.NewRequest("POST", serverURL+"/auth", strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")

	tr := &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}
	client := &http.Client{Transport: tr}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("auth status %d: %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", err
	}
	if token, ok := result["token"].(string); ok {
		return token, nil
	}
	if token, ok := result["bearerToken"].(string); ok {
		return token, nil
	}
	// The auth endpoint may return the token as raw text
	return string(body), nil
}

// postEventToPhysio POSTs a single BoostappCalendarEvent to the physio web server.
func postEventToPhysio(serverURL, token string, e *physio.BoostappCalendarEvent) error {
	// Wrap in a List since that's the body type the service expects
	list := &physio.BoostappCalendarEventList{List: []*physio.BoostappCalendarEvent{e}}
	body, err := protojson.Marshal(list)
	if err != nil {
		return err
	}
	req, _ := http.NewRequest("POST", serverURL+"/physio/50/BstpCal", strings.NewReader(string(body)))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	tr := &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}
	client := &http.Client{Transport: tr}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return fmt.Errorf("status %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}

// fetchParticipantsForEvents enriches each event with its participant list.
// Only fetches for CLASS events (where multiple participants attend). Meetings have inline client info.
func fetchParticipantsForEvents(client *boostapp.Client, events []*physio.BoostappCalendarEvent) {
	for _, e := range events {
		if e.EventType != physio.BoostappEventType_BOOSTAPP_EVENT_TYPE_CLASS {
			continue
		}
		raw, err := client.FetchParticipants(e.EventId)
		if err != nil {
			log("  WARN: failed to fetch participants for event " + e.EventId + ": " + err.Error())
			continue
		}
		e.Participants = boostapp.ConvertParticipants(raw)
	}
}

func log(msg string) {
	println("[boostapp] " + msg)
}

func loadCredentials(res ifs.IResources) (email, password, branchID string, err error) {
	_, email, password, branchID, err = res.Security().Credential("boostapp", "login", res)
	return
}

func syncInterval() time.Duration {
	if v := os.Getenv("BOOSTAPP_SYNC_INTERVAL_MINUTES"); v != "" {
		if m, err := strconv.Atoi(v); err == nil && m > 0 {
			return time.Duration(m) * time.Minute
		}
	}
	return 15 * time.Minute
}

func runSyncLoop(client *boostapp.Client, nic ifs.IVNic, res ifs.IResources, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	syncOnce(client, nic, res)
	for range ticker.C {
		syncOnce(client, nic, res)
	}
}

func syncOnce(client *boostapp.Client, nic ifs.IVNic, res ifs.IResources) {
	start, end := syncDateRange()
	log("--- Sync starting: " + start + " to " + end + " ---")

	log("Fetching calendar from Boostapp...")
	resp, err := client.FetchCalendar(start, end)
	if err != nil {
		log("ERROR: Boostapp fetch failed: " + err.Error())
		return
	}

	events := boostapp.ConvertAll(resp)
	log("Fetched " + strconv.Itoa(len(events)) + " events from Boostapp")

	log("Fetching participants for class events...")
	fetchParticipantsForEvents(client, events)

	log("Fetching PhysioClients for linking...")
	clients := fetchPhysioClients(nic, res)
	linked := 0
	if len(clients) > 0 {
		boostapp.LinkClients(events, clients)
		for _, e := range events {
			if e.PhysioClientId != "" {
				linked++
			}
		}
		log("Linked " + strconv.Itoa(linked) + "/" + strconv.Itoa(len(events)) + " events to PhysioClients")
	} else {
		log("No PhysioClients found for linking")
	}

	log("Posting events to BstpCal service...")
	posted, failed := 0, 0
	for _, e := range events {
		_, err := l8c.PostEntity(boostapp.ServiceName, boostapp.ServiceArea, e, nic)
		if err != nil {
			failed++
			log("  FAIL event " + e.EventId + " (" + e.Title + "): " + err.Error())
		} else {
			posted++
		}
	}
	log("--- Sync complete: " + strconv.Itoa(posted) + " posted, " + strconv.Itoa(failed) + " failed, " + strconv.Itoa(len(events)) + " total ---")
}

func syncDateRange() (string, string) {
	now := time.Now()
	weekday := int(now.Weekday())
	sunday := now.AddDate(0, 0, -weekday)
	saturday := sunday.AddDate(0, 0, 6)
	if weekday >= 4 {
		saturday = saturday.AddDate(0, 0, 7)
	}
	return sunday.Format("2006-01-02"), saturday.Format("2006-01-02")
}

func fetchPhysioClients(nic ifs.IVNic, res ifs.IResources) []*physio.PhysioClient {
	entities, err := l8c.GetEntities("PhyClient", 50, &physio.PhysioClient{}, nic)
	if err != nil {
		res.Logger().Warning("Could not fetch PhysioClients for linking: " + err.Error())
		return nil
	}
	result := make([]*physio.PhysioClient, 0, len(entities))
	for _, e := range entities {
		if c, ok := e.(*physio.PhysioClient); ok {
			result = append(result, c)
		}
	}
	return result
}
