import { MiAccount, MIoTDevice } from './typing.cjs';

type MIoTAccount = MiAccount & {
    device: MIoTDevice;
};
declare class MIoT {
    account: MIoTAccount;
    constructor(account: MIoTAccount);
    static getDevice(account: MIoTAccount): Promise<MIoTAccount>;
    private static __callMIoT;
    private _callMIoT;
    /**
     * - datasource=1  优先从服务器缓存读取，没有读取到下发rpc；不能保证取到的一定是最新值
     * - datasource=2  直接下发rpc，每次都是设备返回的最新值
     * - datasource=3  直接读缓存；没有缓存的 code 是 -70xxxx；可能取不到值
     */
    private _callMIoTSpec;
    /**
     * 获取 MIoT 设备列表
     */
    getDevices(getVirtualModel?: boolean, getHuamiDevices?: number): Promise<any>;
    /**
     * 获取 MIoT 设备属性值
     */
    getProperty(scope: number, property: number): Promise<any>;
    /**
     * 设置 MIoT 设备属性值
     */
    setProperty(scope: number, property: number, value: any): Promise<boolean>;
    /**
     * 调用 MIoT 设备能力指令（你可以在 https://home.miot-spec.com/ 查询具体指令）
     *
     * 比如：
     *
     * ```ts
     * await MIoT.doAction(3, 1);
     * await MIoT.doAction(5, 1, "Hello world, 你好！");
     * ```
     */
    doAction(scope: number, action: number, args?: any): Promise<boolean>;
    /**
     * 调用 MIoT 设备 RPC 指令
     */
    rpc(method: string, params: any, id?: number): Promise<any>;
}

export { MIoT };
