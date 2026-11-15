declare class RC4 {
    iii: number;
    jjj: number;
    bytes: Uint8Array;
    constructor(buf: Buffer);
    update(buf: Buffer): Buffer<ArrayBufferLike>;
}
declare function rc4Hash(method: string, uri: string, data: {
    [x: string]: string;
}, ssecurity: string): string;

export { RC4, rc4Hash };
