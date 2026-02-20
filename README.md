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
- On Linux, this package extracts the binary from a Debian package; required system shared libraries (including Boost and audio/image libs) must be present.
- Ubuntu/Debian example: `sudo apt-get install -y libsndfile1 libid3tag0 libmad0 libgd3 libboost-program-options-dev libboost-filesystem-dev libboost-regex-dev`.
- Smoke tests run with `bun test`.
- CI workflow at `.github/workflows/installer-smoke.yml` runs installer validation on macOS, Linux, and Windows runners.
- Upstream project: https://github.com/bbc/audiowaveform
