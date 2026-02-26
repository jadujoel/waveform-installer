import { afterAll, expect, test } from "bun:test";
import { join } from "node:path";
import {
  $,
  getAudiowaveformCommand,
  getAudiowaveformPath,
  hasAudiowaveformBinary,
  install,
  generate,
  main,
} from "../index";

const tonePath = join(import.meta.dir, "..", "tone.wav");
const generatedFiles = new Set<string>();

function assertPngHeader(bytes: Uint8Array) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  expect(bytes.length).toBeGreaterThanOrEqual(signature.length);
  for (let index = 0; index < signature.length; index++) {
    expect(bytes[index]).toBe(signature[index]);
  }
}

afterAll(async () => {
  await Promise.all(
    Array.from(generatedFiles).map((filePath) => Bun.file(filePath).delete())
  );
});

test("installer provides audiowaveform binary", async () => {
  const exists = await hasAudiowaveformBinary();
  expect(exists).toBe(true);
});

test("installed audiowaveform responds with version", async () => {
  const binaryPath = getAudiowaveformPath();

  const proc = Bun.spawn({
    cmd: [binaryPath, "--version"],
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();

  expect(exitCode).toBe(0);
  expect(`${stdout}\n${stderr}`).toContain("AudioWaveform");
});

test("getAudiowaveformPath resolves to local installer directory", () => {
  const binaryPath = getAudiowaveformPath();
  expect(binaryPath).toContain(`${process.platform === "win32" ? "audiowaveform.exe" : "audiowaveform"}`);
  expect(binaryPath).toContain(`${".audiowaveform"}`);
});

test("getAudiowaveformCommand prepends binary path", () => {
  const args = ["--version", "--help"];
  const command = getAudiowaveformCommand(args);
  expect(command[0]).toBe(getAudiowaveformPath());
  expect(command.slice(1)).toEqual(args);
});

test("audiowaveform generates real png from tone.wav", async () => {
  const output = join(import.meta.dir, "tone.binary.png");
  generatedFiles.add(output);

  const proc = Bun.spawn({
    cmd: [
      getAudiowaveformPath(),
      "-i",
      tonePath,
      "-o",
      output,
      "--bits",
      "8",
      "--zoom",
      "128",
    ],
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;
  const stderr = await new Response(proc.stderr).text();
  expect(exitCode).toBe(0);
  expect(stderr).toBeString();

  const outputFile = Bun.file(output);
  expect(await outputFile.exists()).toBe(true);
  expect(outputFile.size).toBeGreaterThan(0);

  const bytes = new Uint8Array(await outputFile.arrayBuffer()).slice(0, 8);
  assertPngHeader(bytes);
});

test("generate helper creates png from tone.wav", async () => {
  const output = join(import.meta.dir, "tone.helper.png");
  generatedFiles.add(output);

  const generatedPath = await generate({
    input: tonePath,
    output,
    bits: 8,
    zoom: 64,
  });

  expect(generatedPath).toBe(output);
  const outputFile = Bun.file(output);
  expect(await outputFile.exists()).toBe(true);
  expect(outputFile.size).toBeGreaterThan(0);

  const bytes = new Uint8Array(await outputFile.arrayBuffer()).slice(0, 8);
  assertPngHeader(bytes);
});

test("install() returns binary path when already installed", async () => {
  const binaryPath = await install();
  expect(binaryPath).toBe(getAudiowaveformPath());
  expect(await Bun.file(binaryPath).exists()).toBe(true);
});

test("install() runs install script when binary is missing", async () => {
  const binaryPath = getAudiowaveformPath();
  const backupPath = binaryPath + ".bak";
  await Bun.$`mv ${binaryPath} ${backupPath}`.quiet();
  try {
    const result = await install();
    expect(result).toBe(binaryPath);
    expect(await Bun.file(binaryPath).exists()).toBe(true);
  } finally {
    if (await Bun.file(backupPath).exists()) {
      await Bun.$`mv ${backupPath} ${binaryPath}`.quiet();
    }
  }
});

test("$ template literal runs audiowaveform command", async () => {
  const result = await $`--version`;
  expect(result.exitCode).toBe(0);
  const text = result.text();
  expect(text).toContain("AudioWaveform");
});

test("$ template literal with interpolated values", async () => {
  const flag = "--version";
  const result = await $`${flag}`;
  expect(result.exitCode).toBe(0);
  const text = result.text();
  expect(text).toContain("AudioWaveform");
});

test("generate throws on invalid input file", async () => {
  await expect(
    generate({ input: "/nonexistent/file.wav" })
  ).rejects.toThrow("audiowaveform failed");
});

test("generate uses default output, bits, and zoom", async () => {
  const output = tonePath.replace(".wav", ".png");
  generatedFiles.add(output);

  const result = await generate({ input: tonePath });
  expect(result).toBe(output);
  expect(await Bun.file(output).exists()).toBe(true);
});

test("running index.ts as main prints install path", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", join(import.meta.dir, "..", "index.ts")],
    stdout: "pipe",
    stderr: "pipe",
  });
  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  expect(exitCode).toBe(0);
  expect(stdout).toContain("Audiowaveform binary is installed at:");
});

test("main() installs and logs binary path", async () => {
  const logs: string[] = [];
  const origLog = console.log;
  console.log = (...args: unknown[]) => logs.push(args.join(" "));
  try {
    await main();
  } finally {
    console.log = origLog;
  }
  expect(logs.some((l) => l.includes("Audiowaveform binary is installed at:"))).toBe(true);
});
