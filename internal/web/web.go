package web

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"os/exec"
	"sync"
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

func NewWebApp(mode string) (*WebApp, error) {
	return &WebApp{}, nil
}

type WebApp struct {
	mode string
}

func (a *WebApp) Server(ctx context.Context) (*http.Server, error) {
	port := os.Getenv("PORT")
	if port == "" {
		return nil, errors.New("PORT required")
	}
	projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
	if projectID == "" {
		return nil, errors.New("GOOGLE_CLOUD_PROJECT required")
	}
	closer, err := setupTracer(ctx, projectID, a.mode)
	if err != nil {
		return nil, err
	}
	defer closer(ctx)
	logz.SetProjectID(projectID)
	server := &http.Server{
		Handler: otelhttp.NewHandler(middleware.NetHTTP("http")(buildHandler(projectID)), "app"),
		Addr:    fmt.Sprintf(":%s", port),
	}
	return server, nil
}

func setupTracer(ctx context.Context, projectID string, mode string) (func(ctx context.Context) error, error) {
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
	mux.POST("/run", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("content-type", "application/json")
		ctx := r.Context()
		cfg, err := cp.AssumeConfig(ctx)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			logz.Errorf(ctx, "failed to fetch config: %s", err)
			fmt.Fprintln(w, "{\"error\":\"internal error\"}")
			return
		}
		startedAt := time.Now()
		stdout, stderr, err := runScenario(ctx, cfg)
		elapsed := time.Since(startedAt)
		if stderr != nil {
			errout, _ := ioutil.ReadAll(stderr)
			logz.Infof(ctx, "stderr=%q", errout)
		}
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			logz.Errorf(ctx, "failed to run scenario: %s", err)
			fmt.Fprintln(w, "{\"error\":\"failed to run scenario\"}")
			return
		}
		var payload interface{}
		_ = json.NewDecoder(stdout).Decode(&payload)
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(struct {
			ElapsedMilliseconds int64
			Payload             interface{}
		}{
			ElapsedMilliseconds: elapsed.Milliseconds(),
			Payload:             payload,
		})
	}))
	return mux
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

func (c *appConfig) commandEnv() []string {
	names := c.secretNames()
	ret := make([]string, len(names))
	for i, name := range names {
		var value string
		switch name {
		case "GINOU_LOGIN_ID":
			value = c.loginID
		case "GINOU_LOGIN_PASSWORD":
			value = c.loginPassword
		case "GINOU_YOYAKU_URL":
			value = c.yoyakuURL
		}
		ret[i] = fmt.Sprintf("%s=%s", name, value)
	}
	return ret
}

func (_ *appConfig) secretNames() []string {
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

func runScenario(ctx context.Context, cfg *appConfig) (io.Reader, io.Reader, error) {
	if cfg == nil {
		return nil, nil, fmt.Errorf("appConfig is nil")
	}
	ctx, span := otel.Tracer("app").Start(ctx, "runScenario")
	defer span.End()
	stdout := new(bytes.Buffer)
	stderr := new(bytes.Buffer)
	cmd := exec.CommandContext(ctx, "./node_modules/.bin/ts-node", "src/index.ts")
	cmd.Env = os.Environ()
	cmd.Env = append(cmd.Env, cfg.commandEnv()...)
	cmd.Env = append(cmd.Env, "NODE_ENV=production")
	cmd.Stdout = stdout
	cmd.Stderr = stderr
	if err := cmd.Run(); err != nil {
		return stdout, stderr, err
	}
	return stdout, stderr, nil
}
