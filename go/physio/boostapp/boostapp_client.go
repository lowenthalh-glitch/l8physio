package boostapp

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"regexp"
	"strconv"
	"strings"
)

// Client wraps Go's http.Client with Boostapp session management.
type Client struct {
	email    string
	password string
	branchID string
	http     *http.Client
	csrf     string
}

var csrfRegex = regexp.MustCompile(`(?:meta\s+name="csrf-token"\s+content="|csrf[_-]?token['":\s]+['"]?)([a-zA-Z0-9_-]{20,})`)

const (
	baseURL     = "https://login.boostapp.co.il"
	loginURL    = baseURL + "/office/ajax/login/login.php"
	calendarURL = baseURL + "/office/ajax/CalendarView.php"
	officeURL   = baseURL + "/office/"
)

// NewClient creates a Boostapp HTTP client.
func NewClient(email, password, branchID string) *Client {
	jar, _ := cookiejar.New(nil)
	// Boostapp requires a screen_width cookie — without it, calendar.php serves a redirect loop
	// and CalendarView.php returns "Whoops! There was an error."
	u, _ := url.Parse("https://login.boostapp.co.il")
	jar.SetCookies(u, []*http.Cookie{{Name: "screen_width", Value: "1657", Path: "/"}})
	return &Client{
		email:    email,
		password: password,
		branchID: branchID,
		http:     &http.Client{Jar: jar},
	}
}

// Login authenticates with Boostapp via JSON API.
func (c *Client) Login() error {
	payload := `{"username":"` + c.email + `","password":"` + c.password + `","action":"loginByEmail"}`
	req, err := http.NewRequest("POST", loginURL, strings.NewReader(payload))
	if err != nil {
		return errors.New("boostapp login request build failed: " + err.Error())
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", baseURL)
	req.Header.Set("Referer", baseURL+"/")

	resp, err := c.http.Do(req)
	if err != nil {
		return errors.New("boostapp login request failed: " + err.Error())
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return errors.New("boostapp login read failed: " + err.Error())
	}

	if resp.StatusCode != http.StatusOK {
		return errors.New("boostapp login returned status " + resp.Status)
	}

	var result struct {
		Status  interface{} `json:"status"`
		Success bool        `json:"success"`
		Message string      `json:"message"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return errors.New("boostapp login parse failed: " + err.Error())
	}
	if !result.Success {
		return errors.New("boostapp login failed: " + result.Message)
	}

	// Visit the office page to establish full session context and extract CSRF token
	offResp, err := c.http.Get(officeURL)
	if err != nil {
		return errors.New("boostapp office page failed: " + err.Error())
	}
	defer offResp.Body.Close()
	offBody, _ := io.ReadAll(offResp.Body)

	// Try to extract CSRF token from HTML
	matches := csrfRegex.FindSubmatch(offBody)
	if len(matches) >= 2 {
		c.csrf = string(matches[1])
	}

	return nil
}

// EnsureSession checks if the session is still valid by hitting the office page.
func (c *Client) EnsureSession() error {
	resp, err := c.http.Get(officeURL)
	if err != nil {
		return c.Login()
	}
	defer resp.Body.Close()
	io.ReadAll(resp.Body)

	// A redirect away from /office/ means the session expired
	if !strings.HasPrefix(resp.Request.URL.Path, "/office") {
		return c.Login()
	}
	return nil
}

// FetchCalendar retrieves calendar events for the given date range.
// Dates are in "YYYY-MM-DD" format.
func (c *Client) FetchCalendar(startDate, endDate string) (*BoostappCalendarResponse, error) {
	if err := c.EnsureSession(); err != nil {
		return nil, err
	}

	form := url.Values{
		"fun":              {"GetClassesByStudioByDate"},
		"branchId":         {c.branchID},
		"StartDate":        {startDate},
		"EndDate":          {endDate},
		"ViewDate":         {startDate},
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

	req, err := http.NewRequest("POST", calendarURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
	req.Header.Set("X-Requested-With", "XMLHttpRequest")
	req.Header.Set("Origin", baseURL)
	req.Header.Set("Referer", baseURL+"/office/calendar.php")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, errors.New("boostapp calendar fetch failed: " + err.Error())
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, errors.New("boostapp calendar read failed: " + err.Error())
	}

	var result BoostappCalendarResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, errors.New("boostapp calendar parse failed: " + err.Error() + " (body: " + string(body[:min(200, len(body))]) + ")")
	}

	if result.Status != "Success" {
		preview := string(body)
		if len(preview) > 500 {
			preview = preview[:500]
		}
		return nil, errors.New("boostapp calendar returned status: '" + result.Status + "' (body preview: " + preview + ")")
	}

	return &result, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// ParticipantsResponse is the raw response from characteristics-popup.php
type ParticipantsResponse struct {
	ClassData struct {
		ActiveTrainers []map[string]interface{} `json:"activeTrainers"`
	} `json:"js_class_data"`
	PopupContent string `json:"js_char_popup_content"`
}

// ParticipantRaw holds the combined data from activeTrainers + popup HTML.
type ParticipantRaw struct {
	ParticipantID    string // ClientActivitiesId (stable id per participant per class)
	BoostappClientID string // ClientId
	Name             string // Extracted from popup HTML data-name
	Status           string // Status code
	Membership       string // ItemText (membership description)
}

var participantRegex = regexp.MustCompile(`data-clientid="(\d+)"\s*data-classid="\d+"\s*data-actid="(\d+)"\s*data-name=\s*"([^"]+)"`)

// FetchParticipants retrieves the participant list for a given Boostapp event ID.
func (c *Client) FetchParticipants(eventID string) ([]ParticipantRaw, error) {
	if c.csrf == "" {
		// Refresh CSRF token by hitting calendar.php
		if err := c.refreshCSRF(); err != nil {
			return nil, err
		}
	}

	req, err := http.NewRequest("GET", baseURL+"/office/characteristics-popup.php?id="+eventID, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-CSRF-Token", c.csrf)
	req.Header.Set("X-Requested-With", "XMLHttpRequest")
	req.Header.Set("Referer", baseURL+"/office/calendar.php")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, errors.New("boostapp participants fetch failed: " + err.Error())
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var parsed ParticipantsResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, errors.New("boostapp participants parse failed: " + err.Error())
	}

	// Extract names from popup HTML (keyed by ClientId)
	names := make(map[string]string)
	for _, m := range participantRegex.FindAllStringSubmatch(parsed.PopupContent, -1) {
		// m[1]=clientId, m[2]=actId, m[3]=name
		names[m[1]] = strings.TrimSpace(m[3])
	}

	result := make([]ParticipantRaw, 0, len(parsed.ClassData.ActiveTrainers))
	for _, t := range parsed.ClassData.ActiveTrainers {
		clientID := asString(t["ClientId"])
		p := ParticipantRaw{
			ParticipantID:    asString(t["ClientActivitiesId"]),
			BoostappClientID: clientID,
			Name:             names[clientID],
			Status:           asString(t["Status"]),
			Membership:       asString(t["ItemText"]),
		}
		result = append(result, p)
	}
	return result, nil
}

// refreshCSRF fetches calendar.php and extracts the CSRF token.
func (c *Client) refreshCSRF() error {
	resp, err := c.http.Get(baseURL + "/office/calendar.php")
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	matches := csrfRegex.FindSubmatch(body)
	if len(matches) >= 2 {
		c.csrf = string(matches[1])
	}
	return nil
}

func asString(v interface{}) string {
	if v == nil {
		return ""
	}
	switch x := v.(type) {
	case string:
		return x
	case float64:
		return strconv.FormatFloat(x, 'f', -1, 64)
	case int:
		return strconv.Itoa(x)
	case bool:
		if x {
			return "1"
		}
		return "0"
	}
	return ""
}
