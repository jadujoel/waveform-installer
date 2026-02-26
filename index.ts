import { join } from "node:path";

const binaryName = process.platform === "win32" ? "audiowaveform.exe" : "audiowaveform";

export function getAudiowaveformPath(): string {
	return join(import.meta.dir, ".audiowaveform", binaryName);
}

export async function hasAudiowaveformBinary(): Promise<boolean> {
	return Bun.file(getAudiowaveformPath()).exists();
}

export function getAudiowaveformCommand(args: readonly string[] = []): string[] {
	return [getAudiowaveformPath(), ...args];
}

export async function install(): Promise<string | never> {
	const binary = getAudiowaveformPath();
	const exists = await Bun.file(binary).exists();
	if (!exists) {
		const installer = `${import.meta.dir}/scripts/install.ts`;
		await Bun.$`bun ${installer}`;
	}
	return binary
}

/**
 * Template string literal function that forwards to Bun.$
 */
export async function $(strings: TemplateStringsArray, ...values: unknown[]): Promise<Bun.$.ShellOutput | never> {
	const binary = await install()
	const command = strings.reduce((acc, str, index) => {
		if (index >= values.length) return acc + str;
		// Escape backslashes in interpolated values so Windows paths survive shell interpretation
		const escaped = String(values[index] ?? "").replace(/\\/g, "\\\\");
		return acc + str + escaped;
	}, "");
	return Bun.$`${binary} ${{ raw: command }}`;
}

export interface GenerateOptions<
TWavFile extends string = string, // `${string}.wav`,
TWaveformFile extends string = string, // `${string}.png` | `${string}.dat`
> {
	readonly input: TWavFile;
	/**
	 * If not provided, the output file will be named after the input file with a .png extension.
	 * @default `${input}.png`
	 */
	readonly output?: TWaveformFile;
	/**
	 * @default 8
	 */
	readonly bits?: 8 | 16;
	/**
	 * @default 64
	 */
	readonly zoom?: number;
}

export async function generate<const TGenerateOptions extends GenerateOptions>(options: TGenerateOptions): Promise<string> {
	const {
		output = `${options.input.replace(".wav", ".png")}`,
	  bits = 8,
		zoom = 64,
 } = options;

	const binary = await install();
	const proc = Bun.spawn({
		cmd: [
			binary,
			"-i", options.input,
			"-o", output,
			"--bits", String(bits),
			"--zoom", String(zoom),
		],
		stdout: "pipe",
		stderr: "pipe",
	});

	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		const stderr = await new Response(proc.stderr).text();
		throw new Error(`audiowaveform failed with exit code ${exitCode}: ${stderr}`);
	}

	return output;
}

export const Waveform = {
	$,
	binaryName,
	getAudiowaveformPath,
	getAudiowaveformCommand,
	hasAudiowaveformBinary,
	install,
	generate,
	main,
};

export async function main() {
	await install()
	console.log(`Audiowaveform binary is installed at: ${getAudiowaveformPath()}`);
}

import.meta.main && main();
