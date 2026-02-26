package main

import (
	"context"

	"github.com/Benbentwo/aim/backend/session"
	"github.com/Benbentwo/aim/backend/settings"
	"github.com/Benbentwo/aim/backend/worktree"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is the main application struct wired to the Wails runtime.
type App struct {
	ctx            context.Context
	SessionManager  *session.Manager
	WorktreeManager *worktree.Manager
	SettingsManager *settings.Manager
}

// NewApp creates and returns a new App instance.
func NewApp() *App {
	return &App{
		SessionManager:  session.NewManager(),
		WorktreeManager: worktree.NewManager(),
		SettingsManager: settings.NewManager(),
	}
}

// startup is called at application startup. ctx is saved for runtime calls.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.SessionManager.SetContext(ctx)
	a.WorktreeManager.SetContext(ctx)
	a.SettingsManager.SetContext(ctx)
}

// shutdown is called when the application terminates.
func (a *App) shutdown(ctx context.Context) {
	a.SessionManager.Shutdown()
}

// OpenDirectoryDialog opens a native directory picker and returns the selected path.
func (a *App) OpenDirectoryDialog(title string) string {
	path, _ := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:                title,
		CanCreateDirectories: true,
	})
	return path
}
