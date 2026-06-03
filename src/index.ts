#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { Crawler } from './crawler';
import { Downloader } from './downloader';
import { printTree, collectFiles } from './tree';
import { log, formatBytes, formatDuration, setVerbose } from './logger';
import { ScraperOptions } from './types';

const DEFAULT_EXTENSIONS = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'm4v', 'ts'];
const DEFAULT_UA = 'Mozilla/5.0 (compatible; video-scraper/1.0)';

const program = new Command();

program
    .name('video-scraper')
    .description('Descarga videos desde un sitio web con estructura de carpetas')
    .version('1.0.0');

// download (comando principal)
program
    .command('download <url>')
    .alias('dl')
    .description('Crawlea la URL y descarga todos los videos encontrados')
    .option('-o, --output <dir>', 'Directorio de salida', './downloads')
    .option('-c, --concurrency <n>', 'Descargas simultáneas', '5')
    .option('-r, --retries <n>', 'Reintentos por archivo fallido', '3')
    .option('-d, --delay <ms>', 'Delay entre requests (ms)', '200')
    .option('-e, --extensions <exts>', `Extensiones a buscar (separadas por coma)`, DEFAULT_EXTENSIONS.join(','))
    .option('--dry-run', 'Solo mostrar qué se descargaría, sin descargar nada')
    .option('--no-tree', 'No mostrar el árbol de carpetas antes de descargar')
    .option('-v, --verbose', 'Mostrar logs detallados')
    .option('--user-agent <ua>', 'User-Agent HTTP personalizado', DEFAULT_UA)
    .action(async (urlArg: string, opts) => {
        const options: ScraperOptions = {
            url: urlArg,
            output: path.resolve(opts.output),
            concurrency: parseInt(opts.concurrency, 10),
            dryRun: opts.dryRun ?? false,
            verbose: opts.verbose ?? false,
            retries: parseInt(opts.retries, 10),
            delay: parseInt(opts.delay, 10),
            extensions: opts.extensions.split(',').map((e: string) => e.trim()),
            userAgent: opts.userAgent,
        };

        setVerbose(options.verbose);

        // Header
        console.log('');
        console.log(chalk.bold.white('  🎬  video-scraper'));
        console.log(chalk.dim('  ─────────────────────────────────────'));
        console.log(`  ${chalk.dim('URL:')}         ${chalk.cyan(options.url)}`);
        console.log(`  ${chalk.dim('Salida:')}      ${chalk.cyan(options.output)}`);
        console.log(`  ${chalk.dim('Extensiones:')} ${chalk.cyan(options.extensions.join(', '))}`);
        console.log(`  ${chalk.dim('Concurrencia:')}${chalk.cyan(' ' + options.concurrency)}`);
        if (options.dryRun) console.log(`  ${chalk.yellow('⚠  Modo dry-run activado')}`);
        console.log('');

        const startTime = Date.now();

        // Fase 1: Crawling
        log.info('Fase 1/2: Explorando estructura de carpetas...');
        console.log('');

        const crawler = new Crawler(options.url, options.extensions, options.userAgent, options.delay);
        const tree = await crawler.crawl(options.url, options.output);
        const files = collectFiles(tree);

        console.log('');
        log.info(`Encontradas: ${chalk.bold(String(crawler.stats.foldersFound))} carpetas, ${chalk.bold(String(crawler.stats.filesFound))} videos`);

        if (crawler.stats.filesFound === 0) {
            log.warn('No se encontraron videos. Verificá la URL y las extensiones configuradas.');
            process.exit(0);
        }

        // Árbol
        if (opts.tree !== false) {
            console.log('');
            console.log(chalk.bold('  Estructura encontrada:'));
            console.log('');
            printTree(tree);
        }

        console.log('');

        // Fase 2: Descarga
        log.info('Fase 2/2: Descargando videos...');
        console.log('');

        if (!options.dryRun) {
            fs.mkdirSync(options.output, { recursive: true });
        }

        const downloader = new Downloader(
            options.concurrency,
            options.retries,
            options.userAgent,
            options.delay,
            crawler.stats,
            options.dryRun
        );

        await downloader.downloadAll(files);

        // Resumen
        const elapsed = Date.now() - startTime;
        const s = crawler.stats;

        console.log(chalk.bold('  Resumen'));
        console.log(chalk.dim('  ─────────────────────────────────────'));
        console.log(`  ${chalk.green('✔')} Descargados:  ${chalk.bold(String(s.filesDownloaded))}`);
        if (s.filesSkipped > 0)
            console.log(`  ${chalk.dim('·')} Saltados:     ${chalk.dim(String(s.filesSkipped))} (ya existían)`);
        if (s.filesFailed > 0)
            console.log(`  ${chalk.red('✖')} Fallidos:     ${chalk.red(String(s.filesFailed))}`);
        console.log(`  ${chalk.dim('·')} Descargado:   ${chalk.cyan(formatBytes(s.bytesDownloaded))}`);
        console.log(`  ${chalk.dim('·')} Tiempo total: ${chalk.cyan(formatDuration(elapsed))}`);
        if (!options.dryRun && s.filesDownloaded > 0)
            console.log(`  ${chalk.dim('·')} Guardado en:  ${chalk.cyan(options.output)}`);
        console.log('');
    });

// tree (solo crawlea y muestra el árbol)
program
    .command('tree <url>')
    .description('Muestra la estructura de carpetas y videos sin descargar')
    .option('-e, --extensions <exts>', 'Extensiones a buscar', DEFAULT_EXTENSIONS.join(','))
    .option('-d, --delay <ms>', 'Delay entre requests (ms)', '200')
    .option('--user-agent <ua>', 'User-Agent HTTP personalizado', DEFAULT_UA)
    .option('-v, --verbose', 'Logs detallados')
    .action(async (urlArg: string, opts) => {
        setVerbose(opts.verbose ?? false);
        const extensions = opts.extensions.split(',').map((e: string) => e.trim());

        console.log('');
        log.info(`Explorando: ${chalk.cyan(urlArg)}`);
        console.log('');

        const crawler = new Crawler(urlArg, extensions, opts.userAgent, parseInt(opts.delay));
        const tree = await crawler.crawl(urlArg, '.');

        console.log('');
        printTree(tree);
        console.log('');
        log.info(`Total: ${crawler.stats.foldersFound} carpetas, ${crawler.stats.filesFound} videos`);
        console.log('');
    });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
    program.outputHelp();
}
