package packcli

import (
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"

	"github.com/cornworld/vanblog/internal/pack"
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
	root.PersistentFlags().StringVar(&builtinPacksDir, "builtinPacksDir", "../../../packs", "directory with builtin Pack resources")
	root.PersistentFlags().StringVar(&packsDir, "packsDir", "", "directory with local Pack overrides")

	resolve := func() ([]pack.Pack, error) {
		builtins, err := pack.Builtins(os.DirFS(builtinPacksDir))
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
			builtins, err := pack.Builtins(os.DirFS(builtinPacksDir))
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
	return root
}

// Main is used by the root binary's early Pack dispatch.
func Main(args []string) int {
	if err := Execute(args, os.Stdout, os.Stderr); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	return 0
}
