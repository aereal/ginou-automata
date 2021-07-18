package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/aereal/ginou-automata/internal/web"
	"github.com/glassonion1/logz"
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
	app, err := web.NewWebApp(mode)
	if err != nil {
		return err
	}
	server, err := app.Server(ctx)
	if err != nil {
		return err
	}
	go graceful(ctx, server, 5*time.Second)
	logz.Infof(ctx, "start server; mode=%s", mode)
	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		return fmt.Errorf("cannot start server: %w", err)
	}
	return nil
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
