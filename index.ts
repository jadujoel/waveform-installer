import { join } from "node:path";

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

/**
 * Template string literal function that forwards to Bun.$
 */
export function $(strings: TemplateStringsArray, ...values: unknown[]) {
	const command = strings.reduce((acc, str, index) => acc + str + String(values[index] ?? ""), "");
	return Bun.$`${getAudiowaveformPath()} ${command}`;
}

export const Waveform = {
	$,
};
