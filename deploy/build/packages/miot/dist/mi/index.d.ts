import { MiNA } from './mina.js';
import { MIoT } from './miot.js';
import './typing.js';

declare function getMiService(config: {
    service: 'miot' | 'mina';
    userId?: string;
    password?: string;
    passToken?: string;
    did?: string;
    relogin?: boolean;
}): Promise<MIoT | MiNA | undefined>;

export { getMiService };
