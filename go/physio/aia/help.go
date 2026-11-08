package aia

import (
	"embed"
	"sort"
	"strings"
)

// The help documents answer '@help' prompts in the AI assistant. They describe the menus and how-tos of the
// system; keep them in step with the UI.
//
//go:embed help/*.md
var helpFiles embed.FS

// HelpDocs returns all help documents concatenated in file-name order.
func HelpDocs() string {
	entries, err := helpFiles.ReadDir("help")
	if err != nil {
		return ""
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		names = append(names, e.Name())
	}
	sort.Strings(names)
	var b strings.Builder
	for _, n := range names {
		data, err := helpFiles.ReadFile("help/" + n)
		if err != nil {
			continue
		}
		b.Write(data)
		b.WriteString("\n\n")
	}
	return b.String()
}
