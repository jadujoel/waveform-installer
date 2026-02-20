import { expect, test } from "bun:test";
import { hasAudiowaveformBinary, getAudiowaveformPath } from "../index";

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
