package common

import "strings"

// NormalizePhone strips non-digit characters and normalizes Israeli prefix (+972 → 0).
func NormalizePhone(phone string) string {
	var b strings.Builder
	for _, r := range phone {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	s := b.String()
	if strings.HasPrefix(s, "972") && len(s) > 9 {
		s = "0" + s[3:]
	}
	return s
}
