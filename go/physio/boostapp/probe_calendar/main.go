package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/lowenthalh-glitch/l8physio/go/physio/common"
	"github.com/saichler/l8bus/go/overlay/vnic"
	"github.com/saichler/l8types/go/ifs"
)

const (
	baseURL     = "https://login.boostapp.co.il"
	loginURL    = baseURL + "/office/ajax/login/login.php"
	officeURL   = baseURL + "/office/"
	calendarURL = baseURL + "/office/ajax/CalendarView.php"
)

// Fields the current typed struct knows about (boostapp_types.go#BoostappEvent).
var knownEventKeys = map[string]bool{
	"id": true, "title": true, "start": true, "end": true, "owner": true,
	"ownerId": true, "type": true, "status": true, "location": true,
	"locationId": true, "members": true, "maxMembers": true,
	"backgroundColor": true, "titleId": true, "isCancelled": true,
	"isHidden": true, "membersNames": true, "customer": true,
	"price_total": true, "branch": true, "groupNumber": true,
}

func main() {
	// --- 1. Pull creds from the running system via vnet.
	res := common.CreateResources("boostapp-probe", false)
	if os.Getenv("K8S") != "" {
		ifs.SetNetworkMode(ifs.NETWORK_K8s)
	}
	nic := vnic.NewVirtualNetworkInterface(res, nil)
	nic.Start()
	nic.WaitForConnection()
	fmt.Println("vnet connected")

	_, email, pass, branchID, err := res.Security().Credential("boostapp", "login", res)
	must(err, "load credentials")
	fmt.Printf("creds loaded: email=%s branchID=%s\n", email, branchID)

	// --- 2. Hand-rolled login so we don't fight the library's EnsureSession.
	jar, _ := cookiejar.New(nil)
	u, _ := url.Parse(baseURL)
	jar.SetCookies(u, []*http.Cookie{{Name: "screen_width", Value: "1657", Path: "/"}})
	hc := &http.Client{Jar: jar, Timeout: 30 * time.Second}

	// POST login
	loginPayload := `{"username":"` + email + `","password":"` + pass + `","action":"loginByEmail"}`
	req, _ := http.NewRequest("POST", loginURL, strings.NewReader(loginPayload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", baseURL)
	req.Header.Set("Referer", baseURL+"/")
	resp, err := hc.Do(req)
	must(err, "login POST")
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	fmt.Printf("login status=%s bytes=%d\n", resp.Status, len(body))
	var lr struct {
		Status  interface{} `json:"status"`
		Success bool        `json:"success"`
		Message string      `json:"message"`
	}
	if err := json.Unmarshal(body, &lr); err != nil {
		fmt.Printf("login body (first 500): %s\n", preview(body, 500))
		fail("login parse: " + err.Error())
	}
	if !lr.Success {
		fail("login unsuccessful: " + lr.Message)
	}
	fmt.Println("login ok")

	// Visit /office/ to establish session (library does this). Follow final URL.
	off, err := hc.Get(officeURL)
	must(err, "office GET")
	ob, _ := io.ReadAll(off.Body)
	off.Body.Close()
	fmt.Printf("office visit: status=%s final_url=%s bytes=%d\n", off.Status, off.Request.URL.String(), len(ob))

	// --- 3. Fetch calendar directly.
	start := time.Now().Format("2006-01-02")
	end := time.Now().AddDate(0, 0, 7).Format("2006-01-02")
	form := url.Values{
		"fun":              {"GetClassesByStudioByDate"},
		"branchId":         {branchID},
		"StartDate":        {start},
		"EndDate":          {end},
		"ViewDate":         {start},
		"ClassesAll":       {"1"},
		"MeetingsAll":      {"1"},
		"Tasks":            {"1"},
		"Classes":          {""},
		"Meetings":         {""},
		"Locations":        {""},
		"Coaches":          {""},
		"ViewState":        {"timeGridWeek"},
		"SplitView":        {"0"},
		"TypeOfView":       {"1"},
		"extraParams":      {"true"},
		"showAllCoaches":   {"1"},
		"showAllLocations": {"1"},
		"blockEvents":      {"1"},
		"ScreenWidth":      {"1657"},
		"zoomValue":        {"2"},
	}
	creq, _ := http.NewRequest("POST", calendarURL, strings.NewReader(form.Encode()))
	creq.Header.Set("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
	creq.Header.Set("X-Requested-With", "XMLHttpRequest")
	creq.Header.Set("Origin", baseURL)
	creq.Header.Set("Referer", baseURL+"/office/calendar.php")
	cresp, err := hc.Do(creq)
	must(err, "calendar POST")
	cbody, _ := io.ReadAll(cresp.Body)
	cresp.Body.Close()
	fmt.Printf("calendar: status=%s bytes=%d range=%s..%s\n", cresp.Status, len(cbody), start, end)

	var raw map[string]interface{}
	if err := json.Unmarshal(cbody, &raw); err != nil {
		fmt.Printf("calendar body (first 1000): %s\n", preview(cbody, 1000))
		fail("calendar parse: " + err.Error())
	}
	fmt.Println("top-level keys:", keysOf(raw))

	// Dump the whole top-level `branches` and `FilterState` payloads.
	for _, k := range []string{"branches", "FilterState", "filters", "resources"} {
		if v, ok := raw[k]; ok {
			fmt.Printf("\n--- top-level %q ---\n", k)
			p, _ := json.MarshalIndent(v, "", "  ")
			s := string(p)
			if len(s) > 4000 {
				s = s[:4000] + "\n... (truncated)"
			}
			fmt.Println(s)
		}
	}

	classes, _ := raw["Classes"].([]interface{})
	fmt.Printf("Classes count: %d\n", len(classes))
	if len(classes) == 0 {
		return
	}

	// --- 4. Report keys + branch/level-ish value distribution.
	keyCount := map[string]int{}
	branchish := map[string]map[string]int{}
	for _, c := range classes {
		m, ok := c.(map[string]interface{})
		if !ok {
			continue
		}
		for k, v := range m {
			keyCount[k]++
			lk := strings.ToLower(k)
			if strings.Contains(lk, "branch") || strings.Contains(lk, "level") {
				if _, ok := branchish[k]; !ok {
					branchish[k] = map[string]int{}
				}
				branchish[k][fmt.Sprintf("%v", v)]++
			}
		}
	}
	type kv struct {
		k string
		n int
	}
	keys := make([]kv, 0, len(keyCount))
	for k, n := range keyCount {
		keys = append(keys, kv{k, n})
	}
	sort.Slice(keys, func(i, j int) bool { return keys[i].k < keys[j].k })
	fmt.Println("\n--- event keys (NEW = not in BoostappEvent struct) ---")
	for _, e := range keys {
		marker := ""
		if !knownEventKeys[e.k] {
			marker = "   <-- NEW"
		}
		fmt.Printf("  %-24s present on %d/%d events%s\n", e.k, e.n, len(classes), marker)
	}

	if len(branchish) > 0 {
		fmt.Println("\n--- branch/level-ish fields: value distribution ---")
		var bk []string
		for k := range branchish {
			bk = append(bk, k)
		}
		sort.Strings(bk)
		for _, k := range bk {
			fmt.Printf("  %s:\n", k)
			var vals []string
			for v := range branchish[k] {
				vals = append(vals, v)
			}
			sort.Strings(vals)
			for _, v := range vals {
				fmt.Printf("    %4d  %s\n", branchish[k][v], v)
			}
		}
	}

	fmt.Println("\n--- first event (pretty) ---")
	pretty, _ := json.MarshalIndent(classes[0], "", "  ")
	fmt.Println(string(pretty))

	for i, c := range classes {
		m, ok := c.(map[string]interface{})
		if !ok {
			continue
		}
		for k, v := range m {
			lk := strings.ToLower(k)
			if !strings.Contains(lk, "branch") && !strings.Contains(lk, "level") {
				continue
			}
			s := fmt.Sprintf("%v", v)
			ls := strings.ToLower(s)
			if strings.Contains(ls, "movement") || strings.Contains(ls, "rehab") {
				fmt.Printf("\n--- event[%d] with branchish=%q (field=%s) ---\n", i, s, k)
				p, _ := json.MarshalIndent(m, "", "  ")
				fmt.Println(string(p))
				break
			}
		}
	}
}

func keysOf(m map[string]interface{}) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func preview(b []byte, n int) string {
	if len(b) < n {
		n = len(b)
	}
	return string(b[:n])
}

func must(err error, what string) {
	if err != nil {
		fail(what + ": " + err.Error())
	}
}

func fail(msg string) {
	fmt.Fprintln(os.Stderr, "FATAL: "+msg)
	os.Exit(1)
}
