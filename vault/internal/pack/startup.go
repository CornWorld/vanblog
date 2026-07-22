package pack

import "fmt"

// StartupSummary returns safe, deterministic startup diagnostics for resolved
// Packs. It includes only Pack identity, source kind, derived state, and an
// actionable build hint; it never emits resource paths, file contents, or
// credentials.
func StartupSummary(packs, loadable []Pack, warnings []RuntimeWarning) ([]string, error) {
	if err := ValidateV0(packs); err != nil {
		return nil, err
	}
	loadableByPack := make(map[string]struct{}, len(loadable))
	for _, item := range loadable {
		loadableByPack[item.Name] = struct{}{}
	}
	warningByPack := make(map[string]string, len(warnings))
	for _, warning := range warnings {
		warningByPack[warning.Pack] = warning.Reason
	}

	lines := []string{fmt.Sprintf("resolved Packs: %d", len(packs))}
	for _, item := range packs {
		state := "active"
		if item.Source == Builtin {
			state = "builtin-enabled"
		}
		action := ""
		if _, ok := warningByPack[item.Name]; ok {
			state = "needs-rebuild"
			action = "; action=run vanblog pack build with the dev image"

		} else if _, ok := loadableByPack[item.Name]; !ok {
			return nil, fmt.Errorf("pack %q has no derived runtime state", item.Name)
		}
		lines = append(lines, fmt.Sprintf("pack name=%s version=%s source=%s state=%s%s", item.Name, item.Version, item.Source, state, action))
	}
	return lines, nil
}
