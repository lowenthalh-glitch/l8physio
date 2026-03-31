FROM saichler/builder:latest AS build

COPY main.go /home/src/github.com/saichler/build/
RUN go mod init
RUN GOPROXY=direct GOPRIVATE=github.com go mod tidy
RUN go build -o physio-web

FROM saichler/erp-security:latest AS final

COPY --from=build /home/src/github.com/saichler/build/physio-web /home/run/physio-web
COPY web /home/run/web

ENTRYPOINT ["/home/run/physio-web"]
