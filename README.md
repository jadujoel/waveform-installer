# @jadujoel/waveform-installer

Installs a local `audiowaveform` binary for the current OS and architecture so you can precompute Peaks.js waveform data.

## Install

```bash
bun install
```

The `postinstall` script installs or links `audiowaveform` into `.audiowaveform/`.

## Platform behavior

- `darwin` (`arm64`, `x64`): uses Homebrew (`brew install audiowaveform`) if needed, then links the binary locally.
- `linux` (`arm64`, `x64`): extracts binary from official Debian release package.
- `win32` (`x64`, `ia32`): downloads official zip from GitHub releases.

## Linux dependency handling

- After install, Linux runs `ldd` on the binary.
- If shared libraries are missing and system is apt-based, installer attempts auto-fix via `apt-get`.
- Auto-fix requires root or passwordless `sudo`.
- If auto-fix is not possible, installer prints the exact manual `apt-get install` command.

## CLI usage

```bash
./bin/audiowaveform --version
```

## Library usage

```ts
import { getAudiowaveformPath, getAudiowaveformCommand, hasAudiowaveformBinary } from "@jadujoel/waveform-installer";

const installed = await hasAudiowaveformBinary();
const binaryPath = getAudiowaveformPath();
const command = getAudiowaveformCommand(["--version"]);
```

Also exported:

- `$(...)` helper that prefixes commands with the installed `audiowaveform` binary.
- `Waveform.$` alias.

## CI and tests

- Smoke tests: `bun test`.
- Workflow: `.github/workflows/installer-smoke.yml`.
- Current CI matrix validates install on:
	- `macos-latest` (arm64)
	- `ubuntu-24.04-arm`
	- `ubuntu-latest` (x64)
	- `windows-latest` (x64)

## Upstream

- Project source and binaries: https://github.com/bbc/audiowaveform
