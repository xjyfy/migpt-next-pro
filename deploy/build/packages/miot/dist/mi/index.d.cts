import { MiNA } from './mina.cjs';
import { MIoT } from './miot.cjs';
import './typing.cjs';

declare function getMiService(config: {
    service: 'miot' | 'mina';
    userId?: string;
    password?: string;
    passToken?: string;
    did?: string;
    relogin?: boolean;
}): Promise<MIoT | MiNA | undefined>;

export { getMiService };
