FROM saichler/builder:latest AS build

COPY main.go /home/src/github.com/saichler/build/
RUN go mod init
RUN GOPROXY=direct GOPRIVATE=github.com go mod tidy
RUN go build -o physio-log-agent

FROM saichler/phy-security:latest AS final
COPY --from=build /home/src/github.com/saichler/build/physio-log-agent /home/run/physio-log-agent

ENTRYPOINT ["/home/run/physio-log-agent"]
