import { MiServiceConfig as MiServiceConfig$1, MiNA, MIoT } from '@mi-gpt/miot';

type MiServiceConfig = MiServiceConfig$1;
declare class _MiService {
    MiNA?: MiNA;
    MiOT?: MIoT;
    init(config: {
        debug: boolean;
        speaker: MiServiceConfig;
    }): Promise<void>;
}
declare const MiService: _MiService;

export { MiService, type MiServiceConfig };
