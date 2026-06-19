FROM saichler/builder:latest AS build

COPY main.go /home/src/github.com/saichler/build/
RUN go mod init
RUN GOPROXY=direct GOPRIVATE=github.com go mod tidy
RUN go build -o physio-boostapp-collector

FROM saichler/phy-security:latest AS final
COPY --from=build /home/src/github.com/saichler/build/physio-boostapp-collector /home/run/physio-boostapp-collector

ENTRYPOINT ["/home/run/physio-boostapp-collector"]
