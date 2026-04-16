package boostapp

// BoostappCalendarResponse is the top-level JSON response from CalendarView.php.
type BoostappCalendarResponse struct {
	Classes    []BoostappEvent    `json:"Classes"`
	Status     string             `json:"Status"`
	Statistics BoostappStatistics `json:"Statistics"`
}

// BoostappEvent represents a single event in the Boostapp calendar.
type BoostappEvent struct {
	ID              string            `json:"id"`
	Title           string            `json:"title"`
	Start           string            `json:"start"`
	End             string            `json:"end"`
	Owner           string            `json:"owner"`
	OwnerID         string            `json:"ownerId"`
	Type            interface{}       `json:"type"` // int 3 or string "1" — Boostapp is inconsistent
	Status          string            `json:"status"`
	Location        string            `json:"location"`
	LocationID      string            `json:"locationId"`
	Members         string            `json:"members"`
	MaxMembers      string            `json:"maxMembers"`
	BackgroundColor string            `json:"backgroundColor"`
	TitleID         string            `json:"titleId"`
	IsCancelled     bool              `json:"isCancelled"`
	IsHidden        bool              `json:"isHidden"`
	MembersNames    []string          `json:"membersNames"`
	Customer        *BoostappCustomer `json:"customer,omitempty"`
	PriceTotal      string            `json:"price_total,omitempty"`
	Branch          string            `json:"branch"`
	GroupNumber     string            `json:"groupNumber"`
}

// BoostappCustomer is present only on type-1 (1-on-1 meeting) events.
type BoostappCustomer struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Phone string `json:"phone"`
}

// BoostappStatistics is the summary returned alongside the calendar.
type BoostappStatistics struct {
	Events  int `json:"events"`
	Clients int `json:"clients"`
}
