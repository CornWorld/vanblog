package packcli

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/spf13/cobra"

	"github.com/cornworld/vanblog/internal/pack"
	"github.com/cornworld/vanblog/internal/validation"
)

// Execute runs the standalone Pack command without booting PocketBase.
func Execute(args []string, stdout, stderr io.Writer) error {
	cmd := NewCommand()
	cmd.SetArgs(args)
	cmd.SetOut(stdout)
	cmd.SetErr(stderr)
	return cmd.Execute()
}

// NewCommand builds the minimal Pack v0 CLI.
func NewCommand() *cobra.Command {
	var builtinPacksDir string
	var packsDir string
	root := &cobra.Command{
		Use:           "pack",
		Short:         "Inspect and manage Vanblog Packs",
		SilenceUsage:  true,
		SilenceErrors: true,
	}
	var schemaBuilder string
	root.PersistentFlags().StringVar(&builtinPacksDir, "builtinPacksDir", "packs", "directory with builtin Pack resources")
	root.PersistentFlags().StringVar(&packsDir, "packsDir", "", "directory with local Pack overrides")
	root.PersistentFlags().StringVar(&schemaBuilder, "schemaBuilder", "scripts/build/pack-schema-build.mjs", "Node script that builds Pack schema.ts into schema.js")

	resolve := func() ([]pack.Pack, error) {
		builtinPath := resolveExistingPath(builtinPacksDir)
		builtins, err := pack.Builtins(os.DirFS(builtinPath))
		if err != nil {
			return nil, err
		}
		var locals []pack.Pack
		if packsDir != "" {
			locals, err = pack.DiscoverLocal(packsDir)
			if err != nil {
				return nil, err
			}
		}
		return pack.Resolve(builtins, locals)
	}

	root.AddCommand(&cobra.Command{
		Use:   "list",
		Short: "List resolved Packs",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			packs, err := resolve()
			if err != nil {
				return err
			}
			if err := pack.ValidateV0(packs); err != nil {
				return err
			}
			_, warnings, err := pack.RuntimeLoadableV0(packs)
			if err != nil {
				return err
			}
			warningByPack := make(map[string]string, len(warnings))
			for _, warning := range warnings {
				warningByPack[warning.Pack] = warning.Reason
				fmt.Fprintf(cmd.ErrOrStderr(), "warning: pack %s skipped: %s; run vanblog pack build with the dev image\n", warning.Pack, warning.Reason)
			}
			for _, item := range packs {
				status := "runtime-loadable"
				if reason, ok := warningByPack[item.Name]; ok {
					status = "needs-build: " + reason
				}
				fmt.Fprintf(cmd.OutOrStdout(), "%s\t%s\t%s\t%s\n", item.Name, item.Version, item.Source, status)
			}
			return nil
		},
	})

	root.AddCommand(&cobra.Command{
		Use:   "status",
		Short: "Show derived lifecycle status for resolved Packs",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			packs, err := resolve()
			if err != nil {
				return err
			}
			statuses, err := pack.Statuses(packs)
			if err != nil {
				return err
			}
			for _, status := range statuses {
				artifact := "none"
				if item, inspectErr := pack.Inspect(packs, status.Name); inspectErr == nil && pack.HasSchemaArtifact(item) {
					artifact = "schema.js"
				}
				fmt.Fprintf(cmd.OutOrStdout(), "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n", status.Name, status.Version, status.Source, status.State, artifact, status.Freshness, status.SourceHash, status.Reason)
			}
			return nil
		},
	})

	root.AddCommand(&cobra.Command{
		Use:   "plan [directory]",
		Short: "Show read-only Pack deployment preflight; does not build, migrate, backup, or activate",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			var packs []pack.Pack
			var err error
			if len(args) == 1 {
				item, loadErr := pack.LoadLocal(args[0])
				if loadErr != nil {
					return loadErr
				}
				packs = []pack.Pack{item}
			} else {
				packs, err = resolve()
				if err != nil {
					return err
				}
			}
			plans, err := pack.Plans(packs)
			if err != nil {
				return err
			}
			for _, item := range plans {
				fmt.Fprintf(cmd.OutOrStdout(), "%s\t%s\t%s\t%s\t%s\t%s\t%d\t%s\t%s\t%t\t%s\t%s\n", item.Name, item.Version, item.Source, item.State, item.Artifact, item.Freshness, len(item.MigrationFiles), item.MigrationTarget, item.Reason, item.BackupRequired, item.BackupStrategy, item.BackupScope)
			}
			return nil
		},
	})

	root.AddCommand(&cobra.Command{
		Use:   "inspect <name>",
		Short: "Inspect one resolved Pack",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			packs, err := resolve()
			if err != nil {
				return err
			}
			if err := pack.ValidateV0(packs); err != nil {
				return err
			}
			_, warnings, err := pack.RuntimeLoadableV0(packs)
			if err != nil {
				return err
			}
			warningByPack := make(map[string]string, len(warnings))
			for _, warning := range warnings {
				warningByPack[warning.Pack] = warning.Reason
				fmt.Fprintf(cmd.ErrOrStderr(), "warning: pack %s skipped: %s; run vanblog pack build with the dev image\n", warning.Pack, warning.Reason)
			}
			item, err := pack.Inspect(packs, args[0])
			if err != nil {
				return err
			}
			runtimeStatus := "runtime-loadable"
			if reason, ok := warningByPack[item.Name]; ok {
				runtimeStatus = "needs-build: " + reason
			}
			fmt.Fprintf(cmd.OutOrStdout(), "name: %s\nversion: %s\nsource: %s\nruntime: %s\n", item.Name, item.Version, item.Source, runtimeStatus)
			return nil
		},
	})

	root.AddCommand(&cobra.Command{
		Use:   "add <name> [destination]",
		Short: "Add a builtin Pack source to the managed local Pack directory",
		Args:  cobra.RangeArgs(1, 2),
		RunE: func(cmd *cobra.Command, args []string) error {
			builtinPath := resolveExistingPath(builtinPacksDir)
			builtins, err := pack.Builtins(os.DirFS(builtinPath))
			if err != nil {
				return err
			}
			item, err := pack.Inspect(builtins, args[0])
			if err != nil {
				return err
			}
			destination := ""
			if len(args) == 2 {
				destination = args[1]
			} else {
				if packsDir == "" {
					return fmt.Errorf("add destination is required unless --packsDir is set")
				}
				destination = filepath.Join(packsDir, item.Name)
			}
			if err := pack.Add(item, destination); err != nil {
				return err
			}
			fmt.Fprintf(cmd.OutOrStdout(), "added source %s to %s\n", item.Name, destination)
			if _, warnings, err := pack.RuntimeLoadableV0([]pack.Pack{{Name: item.Name, Version: item.Version, FS: item.FS, Source: pack.Local}}); err != nil {
				return err
			} else if len(warnings) > 0 {
				fmt.Fprintf(cmd.OutOrStdout(), "status: needs build artifact; run vanblog pack build with the dev image before production runtime can load it\n")
			}
			return nil
		},
	})

	root.AddCommand(&cobra.Command{
		Use:   "build <directory>",
		Short: "Build local Pack artifacts for production runtime",
		RunE: func(cmd *cobra.Command, args []string) error {
			item, err := pack.LoadLocal(args[0])
			if err != nil {
				return err
			}
			if err := pack.ValidateV0([]pack.Pack{item}); err != nil {
				return err
			}
			directory, err := filepath.Abs(args[0])
			if err != nil {
				return err
			}
			if _, err := os.Stat(filepath.Join(directory, "schema.ts")); os.IsNotExist(err) {
				fmt.Fprintf(cmd.OutOrStdout(), "built artifacts for %s\n", item.Name)
				return nil
			} else if err != nil {
				return err
			}
			builder, err := resolveSchemaBuilderPath(schemaBuilder)
			if err != nil {
				return err
			}
			staged, err := os.CreateTemp(directory, ".schema.js-*")
			if err != nil {
				return fmt.Errorf("create schema staging file: %w", err)
			}
			stagedPath := staged.Name()
			stagedName := filepath.Base(stagedPath)
			if err := staged.Close(); err != nil {
				os.Remove(stagedPath)
				return err
			}
			defer os.Remove(stagedPath)

			buildCmd := exec.Command("node", builder, directory, stagedPath) //nolint:gosec // G204: pack build runs node on the CLI-provided builder script
			buildCmd.Stdout = cmd.OutOrStdout()
			buildCmd.Stderr = cmd.ErrOrStderr()
			if err := buildCmd.Run(); err != nil {
				return fmt.Errorf("pack schema build failed: %w", err)
			}
			if err := validation.ValidateModelSource(validation.PackSource{FS: os.DirFS(directory), Name: item.Name, Path: stagedName}); err != nil {
				return fmt.Errorf("pack schema artifact is not runtime-loadable: %w", err)
			}
			sourceHash, err := pack.Fingerprint(item)
			if err != nil {
				return fmt.Errorf("fingerprint Pack source: %w", err)
			}
			metadata, err := json.Marshal(pack.ArtifactMetadata{SourceHash: sourceHash})
			if err != nil {
				return fmt.Errorf("encode schema artifact metadata: %w", err)
			}
			stagedMetadata, err := os.CreateTemp(directory, ".schema.js.meta.json-*")
			if err != nil {
				return fmt.Errorf("create schema metadata staging file: %w", err)
			}
			stagedMetadataPath := stagedMetadata.Name()
			defer os.Remove(stagedMetadataPath)
			if err := stagedMetadata.Chmod(0o644); err != nil {
				stagedMetadata.Close()
				return fmt.Errorf("prepare schema metadata staging file: %w", err)
			}
			if _, err := stagedMetadata.Write(metadata); err != nil {
				stagedMetadata.Close()
				return fmt.Errorf("stage schema artifact metadata: %w", err)
			}
			if err := stagedMetadata.Close(); err != nil {
				return fmt.Errorf("close schema metadata staging file: %w", err)
			}
			if err := promoteArtifactBundle(directory, stagedPath, stagedMetadataPath); err != nil {
				return err
			}
			fmt.Fprintf(cmd.OutOrStdout(), "built artifacts for %s\n", item.Name)
			return nil
		},
	})

	root.AddCommand(&cobra.Command{
		Use:   "validate <directory>",
		Short: "Validate one local Pack directory",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			item, err := pack.LoadLocal(args[0])
			if err != nil {
				return err
			}
			if err := pack.ValidateV0([]pack.Pack{item}); err != nil {
				return err
			}
			fmt.Fprintf(cmd.OutOrStdout(), "valid source: %s %s\n", item.Name, item.Version)
			if _, warnings, err := pack.RuntimeLoadableV0([]pack.Pack{item}); err != nil {
				return err
			} else if len(warnings) > 0 {
				for _, warning := range warnings {
					fmt.Fprintf(cmd.OutOrStdout(), "runtime: skipped: %s; run vanblog pack build with the dev image\n", warning.Reason)
				}
			} else {
				fmt.Fprintln(cmd.OutOrStdout(), "runtime: loadable")
			}
			return nil
		},
	})
	addThemeCommand(root)
	return root
}

// promoteArtifactBundle swaps staged schema files into place using fixed
// .bak names in the same directory. Unlike a temp-directory backup, this
// survives process death: if the process is killed mid-promotion, the .bak
// files remain and are restored on the next pack build invocation.
func promoteArtifactBundle(directory, stagedSchema, stagedMetadata string) error {
	artifactPath := filepath.Join(directory, "schema.js")
	metadataPath := filepath.Join(directory, "schema.js.meta.json")
	backupSchema := filepath.Join(directory, ".schema.js.bak")
	backupMetadata := filepath.Join(directory, ".schema.js.meta.json.bak")

	// Crash recovery: if leftover .bak files exist from a previous killed
	// promotion, restore them before attempting a new one.
	if _, err := os.Stat(backupSchema); err == nil {
		if err := os.Rename(backupSchema, artifactPath); err != nil {
			return fmt.Errorf("restore backup schema artifact: %w", err)
		}
	}
	if _, err := os.Stat(backupMetadata); err == nil {
		if err := os.Rename(backupMetadata, metadataPath); err != nil {
			return fmt.Errorf("restore backup schema metadata: %w", err)
		}
	}

	// Phase 1: backup existing files to .bak.
	if err := os.Rename(artifactPath, backupSchema); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("backup schema artifact: %w", err)
	}
	if err := os.Rename(metadataPath, backupMetadata); err != nil && !os.IsNotExist(err) {
		return rollbackArtifactBundle(artifactPath, metadataPath, backupSchema, backupMetadata, fmt.Errorf("backup schema metadata: %w", err))
	}

	// Phase 2: promote staged files to final names.
	if err := os.Rename(stagedSchema, artifactPath); err != nil {
		return rollbackArtifactBundle(artifactPath, metadataPath, backupSchema, backupMetadata, fmt.Errorf("promote schema artifact: %w", err))
	}
	if err := os.Rename(stagedMetadata, metadataPath); err != nil {
		return rollbackArtifactBundle(artifactPath, metadataPath, backupSchema, backupMetadata, fmt.Errorf("promote schema metadata: %w", err))
	}

	// Phase 3: clean up .bak files (success).
	os.Remove(backupSchema)
	os.Remove(backupMetadata)
	return nil
}

func rollbackArtifactBundle(artifactPath, metadataPath, backupSchema, backupMetadata string, cause error) error {
	os.Remove(artifactPath)
	os.Remove(metadataPath)
	if _, err := os.Stat(backupSchema); err == nil {
		if restoreErr := os.Rename(backupSchema, artifactPath); restoreErr != nil {
			return fmt.Errorf("%w; restore schema artifact: %v", cause, restoreErr)
		}
	}
	if _, err := os.Stat(backupMetadata); err == nil {
		if restoreErr := os.Rename(backupMetadata, metadataPath); restoreErr != nil {
			return fmt.Errorf("%w; restore schema metadata: %v", cause, restoreErr)
		}
	}
	return cause
}

// repoMarkers are files that identify the repository root. When resolving a
// relative path by walking up from cwd, we verify the candidate's parent
// directory contains at least one marker to avoid picking a directory from a
// sibling or parent project in a monorepo layout.
var repoMarkers = []string{"pnpm-workspace.yaml", "go.mod"}

func resolveExistingPath(path string) string {
	if filepath.IsAbs(path) {
		return path
	}
	cwd, err := os.Getwd()
	if err != nil {
		return path
	}
	for dir := cwd; ; dir = filepath.Dir(dir) {
		candidate := filepath.Join(dir, path)
		if _, err := os.Stat(candidate); err == nil {
			// Confirm we're inside the expected repo before accepting.
			if isRepoRoot(dir) {
				return candidate
			}
			// Found a packs/ directory but no repo marker at this level;
			// keep walking up in case a parent project is the real target.
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
	}
	return path
}

// isRepoRoot returns true when dir is the repository root, identified by
// the presence of at least one known marker file.
func isRepoRoot(dir string) bool {
	for _, marker := range repoMarkers {
		if _, err := os.Stat(filepath.Join(dir, marker)); err == nil {
			return true
		}
	}
	return false
}

func resolveSchemaBuilderPath(path string) (string, error) {
	if filepath.IsAbs(path) {
		if _, err := os.Stat(path); err != nil {
			return "", err
		}
		return path, nil
	}
	cwd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for dir := cwd; ; dir = filepath.Dir(dir) {
		candidate := filepath.Join(dir, path)
		if _, err := os.Stat(candidate); err == nil {
			return candidate, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
	}
	return filepath.Abs(path)
}

// Main is used by the root binary's early Pack dispatch.
func Main(args []string) int {
	if err := Execute(args, os.Stdout, os.Stderr); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	return 0
}
