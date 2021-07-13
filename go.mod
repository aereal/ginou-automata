module github.com/aereal/ginou-automata

go 1.16

require (
	cloud.google.com/go v0.86.0
	github.com/GoogleCloudPlatform/opentelemetry-operations-go v0.20.1 // indirect
	github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/trace v0.20.1
	github.com/dimfeld/httptreemux v5.0.1+incompatible
	github.com/glassonion1/logz v0.3.11
	github.com/golang/groupcache v0.0.0-20210331224755-41bb18bfe9da // indirect
	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.21.0 // indirect
	go.opentelemetry.io/otel v1.0.0-RC1 // indirect
	go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.0.0-RC1 // indirect
	go.opentelemetry.io/otel/sdk v1.0.0-RC1 // indirect
	golang.org/x/net v0.0.0-20210614182718-04defd469f4e // indirect
	golang.org/x/sync v0.0.0-20210220032951-036812b2e83c
	golang.org/x/sys v0.0.0-20210630005230-0f9fa26af87c // indirect
	google.golang.org/genproto v0.0.0-20210713002101-d411969a0d9a
)

replace github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/trace v0.20.1 => github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/trace v0.20.1-0.20210713163924-14c16a38f9bf
