FROM saichler/builder:latest AS build

COPY main.go /home/src/github.com/saichler/build/
RUN go mod init
RUN GOPROXY=direct GOPRIVATE=github.com go mod tidy
RUN go build -o physio-boostapp-parser

FROM saichler/phy-security:latest AS final
COPY --from=build /home/src/github.com/saichler/build/physio-boostapp-parser /home/run/physio-boostapp-parser

ENTRYPOINT ["/home/run/physio-boostapp-parser"]
