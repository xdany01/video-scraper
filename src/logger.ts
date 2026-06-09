import chalk from 'chalk';

let verboseMode = false;

export function setVerbose(v: boolean) {
    verboseMode = v;
}

export const log = {
    info: (msg: string) => console.log(chalk.cyan('ℹ') + '  ' + msg),
    success: (msg: string) => console.log(chalk.green('✔') + '  ' + msg),
    warn: (msg: string) => console.log(chalk.yellow('⚠') + '  ' + msg),
    error: (msg: string) => console.log(chalk.red('✖') + '  ' + msg),
    verbose: (msg: string) => { if (verboseMode) console.log(chalk.gray('·  ' + msg)); },
    folder: (path: string) => console.log(chalk.blue('📁') + ' ' + chalk.bold(path)),
    file: (path: string, isPdf = false) => console.log(chalk.magenta(isPdf ? '📄' : '🎬') + ' ' + path),
    dim: (msg: string) => console.log(chalk.dim(msg)),
};

export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
}
