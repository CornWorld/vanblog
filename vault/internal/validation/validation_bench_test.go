package validation

import (
	"os"
	"testing"

	"github.com/dop251/goja"
)

// loadSchema loads all available schema sources in registration order.
func loadSchema(b *testing.B) []namedProg {
	type entry struct{ name, path string }
	all := []entry{
		{"core", "../../../runtime/core-schema/models.js"},
		{"bookmarks", "../../../packs/bookmarks/schema.js"},
		{"live2d-companion", "../../../packs/live2d-companion/schema.js"},
		{"moments", "../../../packs/moments/schema.js"},
	}
	var out []namedProg
	for _, e := range all {
		data, err := os.ReadFile(e.path)
		if err != nil {
			b.Logf("skip %s: %v", e.name, err)
			continue
		}
		prog, err := compileProgram(string(data))
		if err != nil {
			b.Fatalf("compile %s: %v", e.name, err)
		}
		out = append(out, namedProg{name: e.name, prog: prog})
	}
	if len(out) == 0 {
		b.Skip("no schema artifacts found")
	}
	return out
}

type namedProg struct {
	name string
	prog *goja.Program
}

var mPayload = map[string]any{
	"content": "A quick moment of joy.",
	"author":  "abc123",
	"visible": true,
}

// ---------------------------------------------------------------------------
// 1. FRESH VM — current production code path
// ---------------------------------------------------------------------------
func BenchmarkValidationFreshVM(b *testing.B) {
	sources := loadSchema(b)
	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		for _, src := range sources {
			vm := goja.New()
			if _, err := vm.RunProgram(src.prog); err != nil {
				b.Fatal(err)
			}
			models := vm.Get("exports").ToObject(vm).Get("models").ToObject(vm)
			if models.Get("moments") == nil {
				continue
			}
			if err := validateModel(vm, models, "moments", vm.ToValue(mPayload)); err != nil {
				b.Fatal(err)
			}
			break
		}
	}
}

// ---------------------------------------------------------------------------
// 2. BASE CASE — measure just the validateModel call (no source iteration)
// ---------------------------------------------------------------------------
func BenchmarkValidationBase(b *testing.B) {
	sources := loadSchema(b)
	vm := goja.New()
	vm.RunProgram(sources[len(sources)-1].prog) // last source = moments
	models := vm.Get("exports").ToObject(vm).Get("models").ToObject(vm)

	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		if err := validateModel(vm, models, "moments", vm.ToValue(mPayload)); err != nil {
			b.Fatal(err)
		}
	}
}

// ---------------------------------------------------------------------------
// 3. PRE-ALLOCATED — per-source VMs warmed once, reused forever
//
// Uses a simple pre-allocated slice (one VM per source). This is the
// theoretical upper bound of any pooling strategy — no acquire/release
// overhead, no GC interaction. Safe for sequential use only.
// ---------------------------------------------------------------------------
type warmedVM struct {
	vm     *goja.Runtime
	models *goja.Object
}

func BenchmarkValidationPreAlloc(b *testing.B) {
	sources := loadSchema(b)
	warmed := make([]warmedVM, len(sources))
	for i, src := range sources {
		vm := goja.New()
		if _, err := vm.RunProgram(src.prog); err != nil {
			b.Fatal(err)
		}
		models := vm.Get("exports").ToObject(vm).Get("models").ToObject(vm)
		warmed[i] = warmedVM{vm: vm, models: models}
	}
	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		for i := range warmed {
			if warmed[i].models.Get("moments") == nil {
				continue
			}
			if err := validateModel(warmed[i].vm, warmed[i].models, "moments", warmed[i].vm.ToValue(mPayload)); err != nil {
				b.Fatal(err)
			}
			break
		}
	}
}

// ---------------------------------------------------------------------------
// 4. PRE-ALLOC CONCURRENT — one VM per goroutine, distributed via chan
// ---------------------------------------------------------------------------
func BenchmarkValidationPreAllocConcurrent(b *testing.B) {
	sources := loadSchema(b)

	// Create a channel of VMs for each source. Pre-fill N VMs where N
	// matches the maximum goroutine count (GOMAXPROCS × parallelism).
	n := 64
	pools := make([]chan warmedVM, len(sources))
	for i, src := range sources {
		ch := make(chan warmedVM, n)
		for j := 0; j < n; j++ {
			vm := goja.New()
			if _, err := vm.RunProgram(src.prog); err != nil {
				b.Fatal(err)
			}
			models := vm.Get("exports").ToObject(vm).Get("models").ToObject(vm)
			ch <- warmedVM{vm: vm, models: models}
		}
		pools[i] = ch
	}
	b.ResetTimer()
	b.ReportAllocs()
	b.SetParallelism(8)
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			for i := range pools {
				cv := <-pools[i]
				if cv.models.Get("moments") == nil {
					pools[i] <- cv
					continue
				}
				err := validateModel(cv.vm, cv.models, "moments", cv.vm.ToValue(mPayload))
				pools[i] <- cv
				if err != nil {
					b.Fatal(err)
				}
				break
			}
		}
	})
}

// ---------------------------------------------------------------------------
// 5. MISS PATH — worst case: no source matches the collection
// ---------------------------------------------------------------------------
func BenchmarkValidationPreAllocMiss(b *testing.B) {
	sources := loadSchema(b)
	warmed := make([]warmedVM, len(sources))
	for i, src := range sources {
		vm := goja.New()
		vm.RunProgram(src.prog)
		models := vm.Get("exports").ToObject(vm).Get("models").ToObject(vm)
		warmed[i] = warmedVM{vm: vm, models: models}
	}
	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		for i := range warmed {
			if warmed[i].models.Get("zulu") == nil {
				continue
			}
			b.Fatal("unexpected match for zulu")
		}
	}
}
