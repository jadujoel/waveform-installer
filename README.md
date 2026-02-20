# @jadujoel/waveform-installer

Installs a local `audiowaveform` binary suitable for the current OS + CPU architecture, so you can precompute Peaks.js waveform files without system-level package setup.

## Install

```bash
bun install
```

`postinstall` downloads and places the binary at `.audiowaveform/audiowaveform` (or `.exe` on Windows).

## Supported targets

- `darwin`: `arm64`, `x64` (Homebrew install/link)
- `linux`: `arm64`, `x64` (Debian package extraction)
- `win32`: `x64`, `ia32` (GitHub release zip)

## Use as CLI

```bash
bunx audiowaveform --version
```

## Use as library

```ts
import { getAudiowaveformPath, getAudiowaveformCommand } from "@jadujoel/waveform-installer";

const binaryPath = getAudiowaveformPath();
await Bun.$`binaryPath --version`;
```

## Notes

- On unsupported targets, installation fails with a clear platform/arch message.
- On Linux, this package extracts the binary from a Debian package and checks for missing shared libraries.
- On apt-based systems, installer attempts to auto-install missing runtime packages using root access or passwordless `sudo`.
- If auto-install is not possible, it prints the exact `apt-get install` command to run manually.
- Smoke tests run with `bun test`.
- CI workflow at `.github/workflows/installer-smoke.yml` runs installer validation on macOS, Linux, and Windows runners.
- Upstream project: https://github.com/bbc/audiowaveform
