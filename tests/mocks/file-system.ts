/**
 * Mock file system for testing
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export class MockFileSystem {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();

  constructor() {
    // Add default directories
    this.directories.add('/');
    this.directories.add('/config');
    this.directories.add('/input');
    this.directories.add('/output');
  }

  /**
   * Mock fs.readFile
   */
  async readFile(filePath: string, encoding?: BufferEncoding): Promise<string | Buffer> {
    const normalizedPath = path.normalize(filePath);
    
    if (!this.files.has(normalizedPath)) {
      throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
    }

    const content = this.files.get(normalizedPath)!;
    return encoding ? content : Buffer.from(content);
  }

  /**
   * Mock fs.writeFile
   */
  async writeFile(filePath: string, content: string | Buffer): Promise<void> {
    const normalizedPath = path.normalize(filePath);
    const dir = path.dirname(normalizedPath);
    
    // Ensure directory exists
    if (!this.directories.has(dir)) {
      await this.mkdir(dir, { recursive: true });
    }

    this.files.set(normalizedPath, content.toString());
  }

  /**
   * Mock fs.appendFile
   */
  async appendFile(filePath: string, content: string | Buffer): Promise<void> {
    const normalizedPath = path.normalize(filePath);
    const existing = this.files.get(normalizedPath) || '';
    this.files.set(normalizedPath, existing + content.toString());
  }

  /**
   * Mock fs.mkdir
   */
  async mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<string | undefined> {
    const normalizedPath = path.normalize(dirPath);
    
    if (options?.recursive) {
      const parts = normalizedPath.split(path.sep);
      let currentPath = '';
      
      for (const part of parts) {
        if (part) {
          currentPath = path.join(currentPath, part);
          this.directories.add(currentPath);
        }
      }
    } else {
      const parent = path.dirname(normalizedPath);
      if (!this.directories.has(parent)) {
        throw new Error(`ENOENT: no such file or directory, mkdir '${dirPath}'`);
      }
      this.directories.add(normalizedPath);
    }

    return normalizedPath;
  }

  /**
   * Mock fs.readdir
   */
  async readdir(dirPath: string): Promise<string[]> {
    const normalizedPath = path.normalize(dirPath);
    
    if (!this.directories.has(normalizedPath)) {
      throw new Error(`ENOENT: no such file or directory, scandir '${dirPath}'`);
    }

    const items: string[] = [];
    
    // Find files in this directory
    for (const filePath of this.files.keys()) {
      const fileDir = path.dirname(filePath);
      if (fileDir === normalizedPath) {
        items.push(path.basename(filePath));
      }
    }
    
    // Find subdirectories
    for (const dir of this.directories) {
      const parent = path.dirname(dir);
      if (parent === normalizedPath && dir !== normalizedPath) {
        items.push(path.basename(dir));
      }
    }

    return items;
  }

  /**
   * Mock fs.stat
   */
  async stat(itemPath: string): Promise<{ isDirectory: () => boolean; isFile: () => boolean; size: number }> {
    const normalizedPath = path.normalize(itemPath);
    
    if (this.directories.has(normalizedPath)) {
      return {
        isDirectory: () => true,
        isFile: () => false,
        size: 0
      };
    }
    
    if (this.files.has(normalizedPath)) {
      const content = this.files.get(normalizedPath)!;
      return {
        isDirectory: () => false,
        isFile: () => true,
        size: content.length
      };
    }

    throw new Error(`ENOENT: no such file or directory, stat '${itemPath}'`);
  }

  /**
   * Mock fs.access
   */
  async access(itemPath: string): Promise<void> {
    const normalizedPath = path.normalize(itemPath);
    
    if (!this.files.has(normalizedPath) && !this.directories.has(normalizedPath)) {
      throw new Error(`ENOENT: no such file or directory, access '${itemPath}'`);
    }
  }

  /**
   * Mock fs.rm
   */
  async rm(itemPath: string, options?: { recursive?: boolean; force?: boolean }): Promise<void> {
    const normalizedPath = path.normalize(itemPath);
    
    if (options?.force && !this.exists(normalizedPath)) {
      return; // Force option ignores missing files
    }

    if (this.files.has(normalizedPath)) {
      this.files.delete(normalizedPath);
      return;
    }

    if (this.directories.has(normalizedPath)) {
      if (options?.recursive) {
        // Remove all files and subdirectories
        const toRemove: string[] = [];
        
        for (const filePath of this.files.keys()) {
          if (filePath.startsWith(normalizedPath + path.sep) || filePath === normalizedPath) {
            toRemove.push(filePath);
          }
        }
        
        for (const dirPath of this.directories) {
          if (dirPath.startsWith(normalizedPath + path.sep) || dirPath === normalizedPath) {
            toRemove.push(dirPath);
          }
        }
        
        toRemove.forEach(item => {
          this.files.delete(item);
          this.directories.delete(item);
        });
      } else {
        this.directories.delete(normalizedPath);
      }
      return;
    }

    if (!options?.force) {
      throw new Error(`ENOENT: no such file or directory, unlink '${itemPath}'`);
    }
  }

  /**
   * Check if path exists
   */
  exists(itemPath: string): boolean {
    const normalizedPath = path.normalize(itemPath);
    return this.files.has(normalizedPath) || this.directories.has(normalizedPath);
  }

  /**
   * Get file content directly (for testing)
   */
  getFileContent(filePath: string): string | undefined {
    return this.files.get(path.normalize(filePath));
  }

  /**
   * Set file content directly (for testing)
   */
  setFileContent(filePath: string, content: string): void {
    const normalizedPath = path.normalize(filePath);
    const dir = path.dirname(normalizedPath);
    
    // Ensure directory exists
    this.directories.add(dir);
    this.files.set(normalizedPath, content);
  }

  /**
   * List all files (for debugging)
   */
  listAllFiles(): string[] {
    return Array.from(this.files.keys()).sort();
  }

  /**
   * List all directories (for debugging)
   */
  listAllDirectories(): string[] {
    return Array.from(this.directories).sort();
  }

  /**
   * Clear all files and directories
   */
  clear(): void {
    this.files.clear();
    this.directories.clear();
    this.directories.add('/');
  }

  /**
   * Create a spy that can replace the real fs module
   */
  createFsSpy(): any {
    return {
      readFile: jest.fn().mockImplementation(this.readFile.bind(this)),
      writeFile: jest.fn().mockImplementation(this.writeFile.bind(this)),
      appendFile: jest.fn().mockImplementation(this.appendFile.bind(this)),
      mkdir: jest.fn().mockImplementation(this.mkdir.bind(this)),
      readdir: jest.fn().mockImplementation(this.readdir.bind(this)),
      stat: jest.fn().mockImplementation(this.stat.bind(this)),
      access: jest.fn().mockImplementation(this.access.bind(this)),
      rm: jest.fn().mockImplementation(this.rm.bind(this))
    };
  }
}
