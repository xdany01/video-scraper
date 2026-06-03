export interface ScraperOptions {
    url: string;
    output: string;
    concurrency: number;
    dryRun: boolean;
    verbose: boolean;
    retries: number;
    delay: number;
    extensions: string[];
    userAgent: string;
}

export interface FileNode {
    type: 'file';
    name: string;
    url: string;
    size?: number;
    localPath: string;
}

export interface FolderNode {
    type: 'folder';
    name: string;
    url: string;
    localPath: string;
    children: TreeNode[];
}

export type TreeNode = FileNode | FolderNode;

export interface ScrapeStats {
    foldersFound: number;
    filesFound: number;
    filesDownloaded: number;
    filesSkipped: number;
    filesFailed: number;
    bytesDownloaded: number;
}
