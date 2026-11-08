package aia

import (
	"embed"
	"os"
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

// WebToolsURL is the web tools service (search + fetch) that gives '@web' prompts live web access. The
// PHYSIO_WEB_TOOLS_URL environment variable overrides it; set it to "none" to turn live web access off.
func WebToolsURL() string {
	if v := os.Getenv("PHYSIO_WEB_TOOLS_URL"); v != "" {
		if v == "none" {
			return ""
		}
		return v
	}
	return "https://tools.test-llm.dev"
}
