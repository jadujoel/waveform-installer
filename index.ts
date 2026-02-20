import { join } from "node:path";
import fs from "fs";

const binaryName = process.platform === "win32" ? "audiowaveform.exe" : "audiowaveform";

export function getAudiowaveformPath() {
	return join(import.meta.dir, ".audiowaveform", binaryName);
}

export async function hasAudiowaveformBinary() {
	return Bun.file(getAudiowaveformPath()).exists();
}

export function getAudiowaveformCommand(args: string[] = []) {
	return [getAudiowaveformPath(), ...args];
}

export async function install() {
	const binary = getAudiowaveformPath();
	if (!Bun.file(binary).exists()) {
		await Bun.$`scripts/install.ts`
	}
}

/**
 * Template string literal function that forwards to Bun.$
 */
export function $(strings: TemplateStringsArray, ...values: unknown[]) {
	const binary = getAudiowaveformPath();
	if (!fs.existsSync(binary)) {
		throw new Error(`Audiowaveform binary not found at path: ${binary}`);
	}
	const command = strings.reduce((acc, str, index) => acc + str + String(values[index] ?? ""), "");
	return Bun.$`${binary} ${command}`;
}

export const Waveform = {
	$,
};
