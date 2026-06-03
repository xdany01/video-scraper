import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import * as cliProgress from 'cli-progress';
import { FileNode, ScrapeStats } from './types';
import { log, formatBytes } from './logger';

export class Downloader {
    private concurrency: number;
    private retries: number;
    private userAgent: string;
    private delay: number;
    private stats: ScrapeStats;
    private dryRun: boolean;

    constructor(
        concurrency: number,
        retries: number,
        userAgent: string,
        delay: number,
        stats: ScrapeStats,
        dryRun: boolean
    ) {
        this.concurrency = concurrency;
        this.retries = retries;
        this.userAgent = userAgent;
        this.delay = delay;
        this.stats = stats;
        this.dryRun = dryRun;
    }

    private async downloadFile(file: FileNode, bar: cliProgress.SingleBar): Promise<void> {
        if (this.dryRun) {
            log.dim(`  [dry-run] ${file.localPath}`);
            this.stats.filesSkipped++;
            return;
        }

        // Skip if already exists
        if (fs.existsSync(file.localPath)) {
            const existingSize = fs.statSync(file.localPath).size;
            log.verbose(`Saltando descarga de ${file.name} (${formatBytes(existingSize)})`);
            this.stats.filesSkipped++;
            bar.increment();
            return;
        }

        // Ensure directory exists
        fs.mkdirSync(path.dirname(file.localPath), { recursive: true });

        for (let attempt = 1; attempt <= this.retries; attempt++) {
            try {
                const response = await fetch(file.url, {
                    headers: { 'User-Agent': this.userAgent },
                    redirect: 'follow',
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const totalSize = parseInt(response.headers.get('content-length') || '0', 10);
                const dest = fs.createWriteStream(file.localPath + '.part');

                await new Promise<void>((resolve, reject) => {
                    let downloaded = 0;
                    response.body!.on('data', (chunk: Buffer) => {
                        downloaded += chunk.length;
                        this.stats.bytesDownloaded += chunk.length;
                    });
                    response.body!.pipe(dest);
                    response.body!.on('error', reject);
                    dest.on('finish', resolve);
                    dest.on('error', reject);
                });

                // Rename .part to final file
                fs.renameSync(file.localPath + '.part', file.localPath);
                const finalSize = fs.statSync(file.localPath).size;
                log.verbose(`Descargado: ${file.name} (${formatBytes(finalSize)})`);
                this.stats.filesDownloaded++;
                bar.increment();

                if (this.delay > 0) await new Promise(r => setTimeout(r, this.delay));
                return;

            } catch (err: any) {
                // Clean up partial file
                const partPath = file.localPath + '.part';
                if (fs.existsSync(partPath)) fs.unlinkSync(partPath);

                if (attempt < this.retries) {
                    log.warn(`Reintentando descargar ${file.name} — ${err.message}`);
                    await new Promise(r => setTimeout(r, 1000 * attempt));
                } else {
                    log.error(`Fallo al descargar ${file.name} — ${err.message}`);
                    this.stats.filesFailed++;
                    bar.increment();
                }
            }
        }
    }

    async downloadAll(files: FileNode[]): Promise<void> {
        if (files.length === 0) {
            log.warn('No hay archivos para descargar.');
            return;
        }

        if (this.dryRun) {
            log.info(`[Dry run] Se descargarian ${files.length} archivos:`);
            files.forEach(f => log.dim(`  ${f.localPath}`));
            this.stats.filesSkipped = files.length;
            return;
        }

        log.info(`Descargando ${files.length} archivos con una concurrencia de ${this.concurrency}...`);
        console.log('');

        const bar = new cliProgress.SingleBar({
            format: '  Progreso |{bar}| {value}/{total} archivos | {percentage}% | {duration_formatted}',
            barCompleteChar: '█',
            barIncompleteChar: '░',
            hideCursor: true,
        }, cliProgress.Presets.shades_classic);

        bar.start(files.length, 0);

        // Process in chunks of `concurrency`
        for (let i = 0; i < files.length; i += this.concurrency) {
            const batch = files.slice(i, i + this.concurrency);
            await Promise.all(batch.map(f => this.downloadFile(f, bar)));
        }

        bar.stop();
        console.log('');
    }
}
