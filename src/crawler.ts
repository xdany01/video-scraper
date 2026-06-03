import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import * as path from 'path';
import * as url from 'url';
import { TreeNode, FolderNode, FileNode, ScrapeStats } from './types';
import { log } from './logger';

const DEFAULT_VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv', '.m4v', '.ts', '.m3u8'];

export class Crawler {
    private visited = new Set<string>();
    private baseUrl: string;
    private videoExtensions: string[];
    private userAgent: string;
    private delay: number;
    public stats: ScrapeStats = {
        foldersFound: 0,
        filesFound: 0,
        filesDownloaded: 0,
        filesSkipped: 0,
        filesFailed: 0,
        bytesDownloaded: 0,
    };

    constructor(baseUrl: string, videoExtensions: string[], userAgent: string, delay: number) {
        this.baseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
        this.videoExtensions = videoExtensions.map(e => e.startsWith('.') ? e : '.' + e);
        this.userAgent = userAgent;
        this.delay = delay;
    }

    private async fetchPage(pageUrl: string): Promise<string | null> {
        try {
            log.verbose(`Obteniendo: ${pageUrl}`);
            const response = await fetch(pageUrl, {
                headers: { 'User-Agent': this.userAgent },
                redirect: 'follow',
            });
            if (!response.ok) {
                log.warn(`HTTP ${response.status} para ${pageUrl}`);
                return null;
            }
            return await response.text();
        } catch (err: any) {
            log.error(`Fallo al obtener ${pageUrl}: ${err.message}`);
            return null;
        }
    }

    private resolveUrl(base: string, href: string): string {
        try {
            return new url.URL(href, base).toString();
        } catch {
            return '';
        }
    }

    private isVideoFile(href: string): boolean {
        try {
            const parsed = new url.URL(href, this.baseUrl);
            const pathname = parsed.pathname.toLowerCase().split('?')[0];
            return this.videoExtensions.some(ext => pathname.endsWith(ext));
        } catch {
            return false;
        }
    }

    private isSameHost(href: string): boolean {
        try {
            const base = new url.URL(this.baseUrl);
            const target = new url.URL(href, this.baseUrl);
            return target.hostname === base.hostname;
        } catch {
            return false;
        }
    }

    private isSubPath(parentUrl: string, childHref: string): boolean {
        try {
            const parent = new url.URL(parentUrl);
            const child = new url.URL(childHref, parentUrl);
            if (child.hostname !== parent.hostname) return false;
            const parentPath = parent.pathname.endsWith('/') ? parent.pathname : parent.pathname + '/';
            // La ruta del hijo debe ser estrictamente más profunda (no debe ser el mismo directorio).
            return child.pathname.length > parentPath.length && child.pathname.startsWith(parentPath);
        } catch {
            return false;
        }
    }

    private getNameFromUrl(rawUrl: string): string {
        try {
            const parsed = new url.URL(rawUrl);
            const parts = parsed.pathname.replace(/\/$/, '').split('/');
            return decodeURIComponent(parts[parts.length - 1] || 'unnamed');
        } catch {
            return 'unnamed';
        }
    }

    private localPathFor(fileUrl: string, outputDir: string): string {
        try {
            const base = new url.URL(this.baseUrl);
            const target = new url.URL(fileUrl);
            // Obtener ruta relativa desde la base
            const relPath = target.pathname.startsWith(base.pathname)
                ? target.pathname.slice(base.pathname.length)
                : target.pathname;
            const decoded = decodeURIComponent(relPath).replace(/^\//, '');
            return path.join(outputDir, decoded);
        } catch {
            return path.join(outputDir, this.getNameFromUrl(fileUrl));
        }
    }

    async crawl(pageUrl: string, outputDir: string, depth = 0): Promise<FolderNode> {
        const folderName = this.getNameFromUrl(pageUrl) || 'root';
        const folderLocalPath = this.localPathFor(pageUrl + '/', outputDir).replace(/\/$/, '');

        const node: FolderNode = {
            type: 'folder',
            name: folderName,
            url: pageUrl,
            localPath: folderLocalPath,
            children: [],
        };

        if (this.visited.has(pageUrl)) {
            log.verbose(`Ya visitada: ${pageUrl}`);
            return node;
        }
        this.visited.add(pageUrl);
        this.stats.foldersFound++;

        const indent = '  '.repeat(depth);
        log.folder(`${indent}${folderName}/`);

        const html = await this.fetchPage(pageUrl);
        if (!html) return node;

        const $ = cheerio.load(html);
        const links: Array<{ href: string; text: string }> = [];

        // Obtener todos los enlaces del directorio
        $('a[href]').each((_, el) => {
            const href = $(el).attr('href') || '';
            const text = $(el).text().trim();
            if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:')) {
                links.push({ href, text });
            }
        });

        if (this.delay > 0) await new Promise(r => setTimeout(r, this.delay));

        for (const { href, text } of links) {
            // Listado de directorios de Apache: omitir enlaces de ordenación
            if (href.startsWith('?')) continue;

            // Omitir directorio padre (coincidencia absoluta, relativa o de texto)
            if (href === '/' || href === '../' || href === '..') continue;
            if (text === 'Parent Directory' || text === 'Parent Directory/') continue;

            const resolved = this.resolveUrl(pageUrl, href);
            if (!resolved || !this.isSameHost(resolved)) continue;

            // NUNCA salir del baseUrl original
            if (!this.isSubPath(this.baseUrl, resolved)) continue;

            const cleanHref = href.split('?')[0];

            // Carpeta (termina con /, o sin extensión + subruta)
            if (cleanHref.endsWith('/') || (!path.extname(cleanHref) && this.isSubPath(pageUrl, resolved))) {
                if (resolved !== pageUrl && !this.visited.has(resolved)) {
                    const subFolder = await this.crawl(resolved, outputDir, depth + 1);
                    node.children.push(subFolder);
                }
                continue;
            }

            // Archivo de video
            const ext = path.extname(cleanHref).toLowerCase();
            if (ext && this.videoExtensions.includes(ext)) {
                const fileName = this.getNameFromUrl(resolved) || text || 'video';
                const localPath = this.localPathFor(resolved, outputDir);
                const fileNode: FileNode = {
                    type: 'file',
                    name: fileName,
                    url: resolved,
                    localPath,
                };
                log.file(`${indent}  ${fileName}`);
                node.children.push(fileNode);
                this.stats.filesFound++;
            }
        }

        return node;
    }
}
