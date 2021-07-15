module github.com/aereal/ginou-automata

go 1.16

require (
	github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/trace v0.20.1
	github.com/dimfeld/httptreemux v5.0.1+incompatible
	github.com/glassonion1/logz v0.3.11
	github.com/golang/groupcache v0.0.0-20210331224755-41bb18bfe9da // indirect
	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.21.0
	go.opentelemetry.io/otel v1.0.0-RC1
	go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.0.0-RC1
	go.opentelemetry.io/otel/sdk v1.0.0-RC1
	golang.org/x/net v0.0.0-20210614182718-04defd469f4e // indirect
	golang.org/x/sys v0.0.0-20210630005230-0f9fa26af87c // indirect
)

replace github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/trace v0.20.1 => github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/trace v0.20.1-0.20210713163924-14c16a38f9bf
