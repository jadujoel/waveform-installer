import { join } from "node:path";

const binaryName = process.platform === "win32" ? "audiowaveform.exe" : "audiowaveform";
export const audioWaveformPath = join(import.meta.dir, ".audiowaveform", binaryName);

export function getAudiowaveformPath(): string {
	return audioWaveformPath;
}

export async function hasAudiowaveformBinary(): Promise<boolean> {
	return Bun.file(audioWaveformPath).exists();
}

export function getAudiowaveformCommand(args: readonly string[] = []): string[] {
	return [getAudiowaveformPath(), ...args];
}

export async function install(): Promise<string | never> {
	const binary = getAudiowaveformPath();
	if (!Bun.file(binary).exists()) {
		await Bun.$`scripts/install.ts`
	}
	return binary
}

/**
 * Template string literal function that forwards to Bun.$
 */
export async function $(strings: TemplateStringsArray, ...values: unknown[]): Promise<Bun.$.ShellOutput | never> {
	const binary = await install()
	const command = strings.reduce((acc, str, index) => acc + str + String(values[index] ?? ""), "");
	return Bun.$`${binary} ${command}`;
}

export const Waveform = {
	$,
	binaryName,
	audioWaveformPath,
	getAudiowaveformPath,
	getAudiowaveformCommand,
	hasAudiowaveformBinary,
	install,
};
