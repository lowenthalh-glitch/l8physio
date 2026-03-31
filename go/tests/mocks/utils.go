package mocks

import (
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/saichler/l8erp/go/types/erp"
)

// pickRef safely picks a reference ID by modulo index, returns "" if slice empty
func pickRef(ids []string, index int) string {
	if len(ids) == 0 {
		return ""
	}
	return ids[index%len(ids)]
}

// genID creates an ID like "prefix-001"
func genID(prefix string, index int) string {
	return fmt.Sprintf("%s-%03d", prefix, index+1)
}

// createAuditInfo returns a populated AuditInfo with current timestamp
func createAuditInfo() *erp.AuditInfo {
	now := time.Now().Unix()
	return &erp.AuditInfo{
		CreatedAt:  now,
		CreatedBy:  "mock-generator",
		ModifiedAt: now,
		ModifiedBy: "mock-generator",
	}
}

// randomPhone generates a random US phone number string
func randomPhone() string {
	return fmt.Sprintf("(%03d) %03d-%04d", rand.Intn(900)+100, rand.Intn(900)+100, rand.Intn(9000)+1000)
}

// randomBirthDate returns a Unix timestamp for a random date 20-70 years ago
func randomBirthDate() int64 {
	yearsAgo := rand.Intn(50) + 20
	return time.Now().AddDate(-yearsAgo, -rand.Intn(12), -rand.Intn(28)).Unix()
}

// randomPastDate returns Unix timestamp randomly in the past (up to maxMonths ago)
func randomPastDate(maxMonths int) int64 {
	return time.Now().AddDate(0, -rand.Intn(maxMonths), -rand.Intn(28)).Unix()
}

// randomFutureDate returns Unix timestamp randomly in the future (up to maxMonths ahead)
func randomFutureDate(maxMonths int) int64 {
	return time.Now().AddDate(0, rand.Intn(maxMonths), rand.Intn(28)).Unix()
}

// sanitizeEmail removes non-letter characters from a string for use in email addresses
func sanitizeEmail(s string) string {
	var b strings.Builder
	for _, c := range strings.ToLower(s) {
		if c >= 'a' && c <= 'z' {
			b.WriteRune(c)
		}
	}
	return b.String()
}
