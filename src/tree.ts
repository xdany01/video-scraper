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

function printNode(node: TreeNode, prefix: string, isLast: boolean): void {
    const connector = isLast ? '└── ' : '├── ';
    const extension = isLast ? '    ' : '│   ';

    if (node.type === 'folder') {
        const fileCount = countFiles(node);
        console.log(prefix + connector + chalk.blue.bold(node.name + '/') + chalk.dim(` (${fileCount} videos)`));
        const newPrefix = prefix + extension;
        node.children.forEach((child, i) => {
            printNode(child, newPrefix, i === node.children.length - 1);
        });
    } else {
        console.log(prefix + connector + chalk.magenta(node.name));
    }
}

export function printTree(root: FolderNode): void {
    const totalFiles = countFiles(root);
    console.log(chalk.blue.bold(root.name + '/') + chalk.dim(` (${totalFiles} videos total)`));
    root.children.forEach((child, i) => {
        printNode(child, '', i === root.children.length - 1);
    });
}

export function collectFiles(node: TreeNode): import('./types').FileNode[] {
    if (node.type === 'file') return [node];
    return node.children.flatMap(child => collectFiles(child));
}
