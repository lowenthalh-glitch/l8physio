package main

import (
	"flag"

	"github.com/saichler/l8physio/go/tests/mocks"
)

func main() {
	address := flag.String("address", "http://localhost:8080", "Physio server address")
	user := flag.String("user", "admin", "Username for authentication")
	password := flag.String("password", "admin", "Password for authentication")
	insecure := flag.Bool("insecure", false, "Skip TLS certificate verification")
	flag.Parse()

	mocks.RunMockGenerator(*address, *user, *password, *insecure)
}
