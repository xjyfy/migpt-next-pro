import * as fs from 'node:fs';

declare const kRoot: string;
declare const kEnvs: any;
declare const exists: (filePath: string) => boolean;
declare const getFullPath: (filePath: string) => string;
declare const getExtname: (filePath: string) => string;
declare const deleteFile: (filePath: string) => boolean;
declare const readFile: <T = any>(filePath: string, options?: fs.WriteFileOptions) => Promise<T | undefined> | undefined;
declare const writeFile: (filePath: string, data: string | NodeJS.ArrayBufferView, options?: fs.WriteFileOptions) => Promise<boolean>;
declare const readString: (filePath: string) => Promise<string | undefined> | undefined;
declare const writeString: (filePath: string, content: string) => Promise<boolean>;
declare const readJSON: (filePath: string) => Promise<any>;
declare const writeJSON: (filePath: string, content: any) => Promise<boolean>;
declare const getFiles: (dir: string) => Promise<string[]>;

export { deleteFile, exists, getExtname, getFiles, getFullPath, kEnvs, kRoot, readFile, readJSON, readString, writeFile, writeJSON, writeString };
