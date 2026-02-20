import { join, basename } from "node:path";

type Platform = NodeJS.Platform;
type Arch = NodeJS.Architecture;

const AUDIOWAVEFORM_VERSION = "1.10.2";
const INSTALL_DIR = join(import.meta.dir, "..", ".audiowaveform");
const TEMP_DIR = join(import.meta.dir, "..", ".audiowaveform-tmp");
const BIN_NAME = process.platform === "win32" ? "audiowaveform.exe" : "audiowaveform";
const FINAL_BIN_PATH = join(INSTALL_DIR, BIN_NAME);

const windowsAssetByArch: Partial<Record<Arch, string>> = {
  x64: `audiowaveform-${AUDIOWAVEFORM_VERSION}-win64.zip`,
  ia32: `audiowaveform-${AUDIOWAVEFORM_VERSION}-win32.zip`,
};

const linuxAssetByArch: Partial<Record<Arch, string>> = {
  x64: `audiowaveform_${AUDIOWAVEFORM_VERSION}-1-13_amd64.deb`,
  arm64: `audiowaveform_${AUDIOWAVEFORM_VERSION}-1-13_arm64.deb`,
};

const linuxDependencyPackageByLibraryPrefix = [
  { libraryPrefix: "libsndfile.so", aptPackage: "libsndfile1" },
  { libraryPrefix: "libid3tag.so", aptPackage: "libid3tag0" },
  { libraryPrefix: "libmad.so", aptPackage: "libmad0" },
  { libraryPrefix: "libgd.so", aptPackage: "libgd3" },
  { libraryPrefix: "libboost_program_options.so", aptPackage: "libboost-program-options-dev" },
  { libraryPrefix: "libboost_filesystem.so", aptPackage: "libboost-filesystem-dev" },
  { libraryPrefix: "libboost_regex.so", aptPackage: "libboost-regex-dev" },
] as const;

async function main() {
  await cleanDirectory(TEMP_DIR);
  await ensureDirectory(INSTALL_DIR);

  try {
    if (process.platform === "win32") {
      await installOnWindows(process.arch);
    } else if (process.platform === "linux") {
      await installOnLinux(process.arch);
    } else if (process.platform === "darwin") {
      await installOnDarwin(process.arch);
    } else {
      throw unsupportedPlatformError(process.platform, process.arch);
    }

    await makeExecutable(FINAL_BIN_PATH);
    console.log(`Installed audiowaveform to ${FINAL_BIN_PATH}`);
  } finally {
    await safeRemove(TEMP_DIR);
  }
}

async function installOnWindows(arch: Arch) {
  const asset = windowsAssetByArch[arch];
  if (!asset) {
    throw unsupportedPlatformError("win32", arch);
  }

  const url = githubReleaseUrl(asset);
  const zipPath = join(TEMP_DIR, asset);
  const extractDir = join(TEMP_DIR, "extract");

  await download(url, zipPath);
  await ensureDirectory(extractDir);

  await Bun.$`powershell -NoLogo -NoProfile -Command Expand-Archive -Path ${zipPath} -DestinationPath ${extractDir} -Force`;

  const exePath = await findSingleFile(extractDir, "**/audiowaveform.exe");
  await Bun.write(FINAL_BIN_PATH, Bun.file(exePath));
}

async function installOnLinux(arch: Arch) {
  const asset = linuxAssetByArch[arch];
  if (!asset) {
    throw unsupportedPlatformError("linux", arch);
  }

  const url = githubReleaseUrl(asset);
  const debPath = join(TEMP_DIR, asset);
  const unpackDir = join(TEMP_DIR, "unpack");
  const rootFsDir = join(TEMP_DIR, "rootfs");

  await download(url, debPath);
  await ensureDirectory(unpackDir);
  await ensureDirectory(rootFsDir);

  await Bun.$`ar x ${debPath}`.cwd(unpackDir);

  const dataTar = await findSingleFile(unpackDir, "data.tar.*");
  await Bun.$`tar -xf ${dataTar} -C ${rootFsDir}`;

  const binaryPath = join(rootFsDir, "usr", "bin", "audiowaveform");
  if (!(await Bun.file(binaryPath).exists())) {
    throw new Error("Unable to locate audiowaveform binary in Debian package");
  }

  await Bun.write(FINAL_BIN_PATH, Bun.file(binaryPath));

  await ensureLinuxRuntimeDependencies(FINAL_BIN_PATH);
}

async function installOnDarwin(arch: Arch) {
  if (arch !== "arm64" && arch !== "x64") {
    throw unsupportedPlatformError("darwin", arch);
  }

  let binaryPath = Bun.which("audiowaveform");

  if (!binaryPath) {
    const brewPath = Bun.which("brew");
    if (!brewPath) {
      throw new Error(
        [
          "audiowaveform is not installed and Homebrew is not available.",
          "Install Homebrew first: https://brew.sh",
          "Then re-run: bun install",
        ].join("\n"),
      );
    }

    console.log("Installing audiowaveform via Homebrew...");
    await Bun.$`${brewPath} install audiowaveform`;
    binaryPath = Bun.which("audiowaveform");
  }

  if (!binaryPath) {
    throw new Error("Unable to locate audiowaveform after Homebrew install");
  }

  await Bun.$`ln -sf ${binaryPath} ${FINAL_BIN_PATH}`;
}

async function download(url: string, destination: string, headers?: Record<string, string>) {
  console.log(`Downloading ${basename(destination)}...`);

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${url}`);
  }

  const content = await response.arrayBuffer();
  await Bun.write(destination, content);
}

async function ensureLinuxRuntimeDependencies(binaryPath: string) {
  const missingLibraries = await getMissingSharedLibraries(binaryPath);
  if (missingLibraries.length === 0) {
    return;
  }

  const missingPackages = getAptPackagesForMissingLibraries(missingLibraries);

  if (missingPackages.length === 0) {
    throw new Error(
      [
        "audiowaveform requires missing shared libraries that could not be mapped to apt packages:",
        ...missingLibraries.map((library) => `- ${library}`),
        "Install required runtime dependencies for your distro, then re-run bun install.",
      ].join("\n"),
    );
  }

  const aptGetPath = Bun.which("apt-get");
  if (!aptGetPath) {
    throw new Error(
      [
        "audiowaveform requires Linux runtime libraries that are not installed.",
        `Missing libs: ${missingLibraries.join(", ")}`,
        "This installer can auto-fix dependencies only on apt-based systems.",
      ].join("\n"),
    );
  }

  const canUseSudo = await hasSudoWithoutPassword();
  const isRoot = typeof process.getuid === "function" && process.getuid() === 0;

  if (!isRoot && !canUseSudo) {
    throw new Error(
      [
        "audiowaveform requires Linux runtime libraries that are not installed.",
        `Missing libs: ${missingLibraries.join(", ")}`,
        "Unable to auto-install because this process has no root access or passwordless sudo.",
        `Run manually: sudo apt-get update && sudo apt-get install -y ${missingPackages.join(" ")}`,
      ].join("\n"),
    );
  }

  console.log(`Installing missing Linux runtime packages: ${missingPackages.join(", ")}`);

  if (isRoot) {
    await Bun.$`${aptGetPath} update`;
    await Bun.$`${aptGetPath} install -y ${missingPackages}`;
  } else {
    const sudoPath = Bun.which("sudo");
    if (!sudoPath) {
      throw new Error("sudo command not found");
    }

    await Bun.$`${sudoPath} -n ${aptGetPath} update`;
    await Bun.$`${sudoPath} -n ${aptGetPath} install -y ${missingPackages}`;
  }

  const stillMissing = await getMissingSharedLibraries(binaryPath);
  if (stillMissing.length > 0) {
    throw new Error(
      [
        "audiowaveform still has missing shared libraries after attempted auto-install:",
        ...stillMissing.map((library) => `- ${library}`),
      ].join("\n"),
    );
  }
}

async function getMissingSharedLibraries(binaryPath: string) {
  const lddPath = Bun.which("ldd");
  if (!lddPath) {
    return [];
  }

  const result = await Bun.$`${lddPath} ${binaryPath}`.quiet();
  const output = result.text();

  const missingLibraries: string[] = [];
  for (const line of output.split("\n")) {
    if (!line.includes("=> not found")) {
      continue;
    }

    const [name] = line.trim().split(" => ");
    if (name) {
      missingLibraries.push(name);
    }
  }

  return missingLibraries;
}

function getAptPackagesForMissingLibraries(missingLibraries: string[]) {
  const aptPackages = new Set<string>();

  for (const libraryName of missingLibraries) {
    const match = linuxDependencyPackageByLibraryPrefix.find(({ libraryPrefix }) =>
      libraryName.startsWith(libraryPrefix),
    );

    if (match) {
      aptPackages.add(match.aptPackage);
    }
  }

  return [...aptPackages];
}

async function hasSudoWithoutPassword() {
  const sudoPath = Bun.which("sudo");
  if (!sudoPath) {
    return false;
  }

  try {
    await Bun.$`${sudoPath} -n true`.quiet();
    return true;
  } catch {
    return false;
  }
}

function githubReleaseUrl(assetFileName: string) {
  return `https://github.com/bbc/audiowaveform/releases/download/${AUDIOWAVEFORM_VERSION}/${assetFileName}`;
}

function unsupportedPlatformError(platform: Platform, arch: Arch) {
  return new Error(
    [
      `Unsupported platform: ${platform}/${arch}.`,
      "Supported targets:",
      "- darwin: arm64, x64",
      "- linux: arm64, x64",
      "- win32: x64, ia32",
      "If you need another target, install audiowaveform manually and point your tooling at that binary.",
    ].join("\n"),
  );
}

async function findSingleFile(rootDir: string, pattern: string) {
  const glob = new Bun.Glob(pattern);
  const matches = await Array.fromAsync(glob.scan({ cwd: rootDir, absolute: true }));

  if (matches.length === 0) {
    throw new Error(`No files matched pattern: ${pattern}`);
  }

  return matches[0]!;
}

async function makeExecutable(filePath: string) {
  if (process.platform === "win32") {
    return;
  }

  await Bun.$`chmod 755 ${filePath}`;
}

async function ensureDirectory(dirPath: string) {
  await Bun.$`mkdir -p ${dirPath}`;
}

async function safeRemove(path: string) {
  await Bun.$`rm -rf ${path}`;
}

async function cleanDirectory(dirPath: string) {
  await safeRemove(dirPath);
  await ensureDirectory(dirPath);
}

await main();
