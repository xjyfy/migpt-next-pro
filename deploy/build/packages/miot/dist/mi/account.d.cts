import { MiAccount } from './typing.cjs';

declare function getAccount(_account: MiAccount): Promise<MiAccount | undefined>;

export { getAccount };
