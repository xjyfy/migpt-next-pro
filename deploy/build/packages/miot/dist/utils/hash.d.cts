declare function md5(s: string): string;
declare function sha1(s: string): string;
declare function sha256(snonce: string, msg: string): string;
declare function signNonce(ssecurity: string, nonce: string): string;
declare function uuid(): `${string}-${string}-${string}-${string}-${string}`;
declare function randomString(len: number): string;
declare function randomNoise(): string;

export { md5, randomNoise, randomString, sha1, sha256, signNonce, uuid };
