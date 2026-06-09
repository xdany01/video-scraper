import chalk from 'chalk';
import { TreeNode, FolderNode } from './types';

function countFiles(node: FolderNode): number {
    let count = 0;
    for (const child of node.children) {
        if (child.type === 'file') count++;
        else count += countFiles(child);
    }
    return count;
}

function getFileCountLabel(node: FolderNode): string {
    const files = collectFiles(node);
    if (files.length === 0) return '0 archivos';
    const pdfCount = files.filter(f => f.name.toLowerCase().endsWith('.pdf')).length;
    const videoCount = files.length - pdfCount;
    if (pdfCount > 0 && videoCount > 0) {
        return `${videoCount} videos, ${pdfCount} PDFs`;
    } else if (pdfCount > 0) {
        return `${pdfCount} PDFs`;
    } else {
        return `${videoCount} videos`;
    }
}

function printNode(node: TreeNode, prefix: string, isLast: boolean): void {
    const connector = isLast ? '└── ' : '├── ';
    const extension = isLast ? '    ' : '│   ';

    if (node.type === 'folder') {
        const label = getFileCountLabel(node);
        console.log(prefix + connector + chalk.blue.bold(node.name + '/') + chalk.dim(` (${label})`));
        const newPrefix = prefix + extension;
        node.children.forEach((child, i) => {
            printNode(child, newPrefix, i === node.children.length - 1);
        });
    } else {
        console.log(prefix + connector + chalk.magenta(node.name));
    }
}

export function printTree(root: FolderNode): void {
    const label = getFileCountLabel(root);
    console.log(chalk.blue.bold(root.name + '/') + chalk.dim(` (${label} total)`));
    root.children.forEach((child, i) => {
        printNode(child, '', i === root.children.length - 1);
    });
}

export function collectFiles(node: TreeNode): import('./types').FileNode[] {
    if (node.type === 'file') return [node];
    return node.children.flatMap(child => collectFiles(child));
}
