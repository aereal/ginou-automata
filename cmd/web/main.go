package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	secretmanager "cloud.google.com/go/secretmanager/apiv1"
	texporter "github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/trace"
	"github.com/dimfeld/httptreemux"
	"github.com/glassonion1/logz"
	"github.com/glassonion1/logz/middleware"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/stdout/stdouttrace"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"golang.org/x/sync/errgroup"
	pb "google.golang.org/genproto/googleapis/cloud/secretmanager/v1"
)

var mode string

func main() {
	if err := run(); err != nil {
		fmt.Printf("! %+v\n", err)
		os.Exit(1)
	}
}

func run() error {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	port := os.Getenv("PORT")
	if port == "" {
		return errors.New("PORT required")
	}
	projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
	if projectID == "" {
		return errors.New("GOOGLE_CLOUD_PROJECT required")
	}
	closer, err := setupTracer(ctx, projectID)
	if err != nil {
		return err
	}
	defer closer(ctx)
	logz.SetProjectID(projectID)
	server := &http.Server{
		Handler: otelhttp.NewHandler(middleware.NetHTTP("http")(buildHandler(projectID)), "app"),
		Addr:    fmt.Sprintf(":%s", port),
	}
	go graceful(ctx, server, 5*time.Second)
	logz.Infof(ctx, "start server; mode=%s", mode)
	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		return fmt.Errorf("cannot start server: %w", err)
	}
	return nil
}

type configProvider struct {
	cache     *appConfig
	projectID string
}

func (p *configProvider) AssumeConfig(ctx context.Context) (*appConfig, error) {
	if p.cache != nil {
		return p.cache, nil
	}
	var err error
	p.cache, err = p.fetchConfig(ctx)
	if err != nil {
		return nil, err
	}
	return p.cache, nil
}

func (p *configProvider) fetchConfig(ctx context.Context) (*appConfig, error) {
	svc, err := secretmanager.NewClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("secretmanager.NewClient: %w", err)
	}
	eg, ctx := errgroup.WithContext(ctx)
	cfg := &appConfig{}
	for _, name := range cfg.secretNames() {
		n := name
		eg.Go(func() error {
			resp, err := svc.AccessSecretVersion(ctx, &pb.AccessSecretVersionRequest{
				Name: fmt.Sprintf("projects/%s/secrets/%s/versions/latest", p.projectID, n),
			})
			if err != nil {
				return fmt.Errorf("AccessSecretVersion: name=%s error=%w", n, err)
			}
			if err := cfg.consume(n, resp.Payload.Data); err != nil {
				return fmt.Errorf("consume failed: name=%s error=%w", n, err)
			}
			return nil
		})
	}
	if err := eg.Wait(); err != nil {
		logz.Errorf(ctx, "failure: %+v", err)
		return nil, err
	}
	return cfg, nil
}

type appConfig struct {
	mux           sync.Mutex
	loginID       string
	loginPassword string
	yoyakuURL     string
}

func (a *appConfig) secretNames() []string {
	return []string{"GINOU_LOGIN_ID", "GINOU_LOGIN_PASSWORD", "GINOU_YOYAKU_URL"}
}

func (c *appConfig) consume(name string, encodedValue []byte) error {
	c.mux.Lock()
	defer c.mux.Unlock()
	switch name {
	case "GINOU_LOGIN_ID":
		c.loginID = string(encodedValue)
		return nil
	case "GINOU_LOGIN_PASSWORD":
		c.loginPassword = string(encodedValue)
		return nil
	case "GINOU_YOYAKU_URL":
		c.yoyakuURL = string(encodedValue)
		return nil
	default:
		return fmt.Errorf("unknown name: %s", name)
	}
}

func buildHandler(projectID string) http.Handler {
	mux := httptreemux.NewContextMux()
	cp := &configProvider{projectID: projectID}
	mux.GET("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		w.Header().Set("content-type", "application/json")
		_, err := cp.AssumeConfig(ctx)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			fmt.Fprintln(w, "{\"error\":\"internal error\"}")
			return
		}
		w.WriteHeader(http.StatusOK)
		fmt.Fprintln(w, "{\"ok\":true}")
	}))
	return mux
}

func setupTracer(ctx context.Context, projectID string) (func(ctx context.Context) error, error) {
	var (
		exporter sdktrace.SpanExporter
		err      error
	)
	if mode == "local" {
		exporter, err = stdouttrace.New()
	} else {
		exporter, err = texporter.NewExporter(texporter.WithProjectID(projectID))
	}
	if err != nil {
		return func(_ context.Context) error { return nil }, err
	}
	tp := sdktrace.NewTracerProvider(sdktrace.WithBatcher(exporter))
	otel.SetTracerProvider(tp)
	return tp.ForceFlush, nil
}

func graceful(ctx context.Context, server *http.Server, timeout time.Duration) {
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	sig := <-sigChan
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	logz.Infof(ctx, "shutting down server; signal=%q", sig)
	if err := server.Shutdown(ctx); err != nil {
		logz.Warningf(ctx, "failed to shutdown: %s", err)
	}
}
