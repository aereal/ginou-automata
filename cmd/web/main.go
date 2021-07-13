package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/dimfeld/httptreemux"
	"github.com/glassonion1/logz"
	"github.com/glassonion1/logz/middleware"
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

func buildHandler() http.Handler {
	mux := httptreemux.NewContextMux()
	mux.GET("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logz.Infof(r.Context(), "GET /")
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
