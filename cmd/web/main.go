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
	"github.com/dimfeld/httptreemux"
	"github.com/glassonion1/logz"
	"github.com/glassonion1/logz/middleware"
	"golang.org/x/sync/errgroup"
	pb "google.golang.org/genproto/googleapis/cloud/secretmanager/v1"
)

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
	logz.SetProjectID(projectID)
	server := &http.Server{
		Handler: middleware.NetHTTP("http")(buildHandler()),
		Addr:    fmt.Sprintf(":%s", port),
	}
	go graceful(ctx, server, 5*time.Second)
	logz.Infof(ctx, "start server")
	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		return fmt.Errorf("cannot start server: %w", err)
	}
	return nil
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

func buildHandler() http.Handler {
	mux := httptreemux.NewContextMux()
	mux.GET("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		svc, err := secretmanager.NewClient(ctx)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			logz.Errorf(ctx, "secretmanager.NewClient: %s", err)
			fmt.Fprintln(w, "{\"error\":\"internal error\"}")
			return
		}
		eg, ctx := errgroup.WithContext(ctx)
		cfg := &appConfig{}
		for _, name := range cfg.secretNames() {
			n := name
			eg.Go(func() error {
				resp, err := svc.AccessSecretVersion(ctx, &pb.AccessSecretVersionRequest{
					Name: fmt.Sprintf("projects/%s/secrets/%s/versions/latest", os.Getenv("GOOGLE_CLOUD_PROJECT"), n),
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
			w.WriteHeader(http.StatusInternalServerError)
			logz.Errorf(ctx, "failure: %+v", err)
			fmt.Fprintln(w, "{\"error\":\"internal error\"}")
			return
		}
		w.WriteHeader(http.StatusOK)
		fmt.Fprintln(w, "{\"ok\":true}")
	}))
	return mux
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
