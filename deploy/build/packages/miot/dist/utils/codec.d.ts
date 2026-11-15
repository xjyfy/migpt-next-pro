import { MiPass } from '../mi/typing.js';

declare function encodeBase64(text: string): string;
declare function decodeBase64(base64Encoded: string): string;
declare function parseAuthPass(res: string): {
    code?: number;
    description?: string;
    captchaUrl?: string;
    notificationUrl?: string;
} & MiPass;
declare function encodeQuery(data: Record<string, string | number | boolean | undefined>): string;
declare function decodeQuery(str: string): any;
interface MIoTRequest {
    data: string;
    rc4_hash__: string;
    signature: string;
    _nonce: string;
    ssecurity: string;
}
declare function encodeMIoT(method: string, uri: string, data: any, ssecurity: string): MIoTRequest;
declare function decodeMIoT(ssecurity: string, nonce: string, data: string, gzip?: boolean): Promise<any | undefined>;

export { decodeBase64, decodeMIoT, decodeQuery, encodeBase64, encodeMIoT, encodeQuery, parseAuthPass };
