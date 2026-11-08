package aia

import (
	_ "embed"
	"os"
)

// haloCA is the CA that signed the certificates of the LLM and web tools servers on the local network. It is a
// public certificate (no key).
//
//go:embed halo-ca.crt
var haloCA string

// LANRoutes lists the services reachable directly on the local network. The agent tries these first and uses
// the public (tunnel) address only when the LAN address cannot be reached. PHYSIO_LAN_HOST overrides the
// server's address; set it to "none" to always use the public addresses.
func LANRoutes() map[string]string {
	host := "192.168.1.124"
	if v := os.Getenv("PHYSIO_LAN_HOST"); v != "" {
		if v == "none" {
			return nil
		}
		host = v
	}
	return map[string]string{
		"llm.test-llm.dev":   host + ":8080",
		"tools.test-llm.dev": host + ":8083",
	}
}

// LANCA returns the PEM of the CA that signed the LAN servers' certificates.
func LANCA() string { return haloCA }
