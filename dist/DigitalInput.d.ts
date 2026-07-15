import { ConfigString } from "./KeyCode";
export type DigitalInputReader<Action extends string> = {
    isPressed(action: Action): boolean;
    isReleased(action: Action): boolean;
    isPushed(action: Action): boolean;
    isSomethingPressed(): boolean;
};
/**
 * e.codeまたは、ゲームパッドのボタン/軸に対応する文字列をアクションに割り当てることで、
 * キーボードとゲームパッドの入力を統一的に扱えるようにする。
 *
 * 例: new DigitalInput({ right: ["ArrowRight", "gamepad-button-15", "gamepad-axis-0-positive"] })
 * これで、右矢印キーまたはゲームパッドの右ボタンが押されるまたは左スティックを右に倒すと、action "right" が押されたことになる。
 *
 * 基本的にシングルトンとして使うことを想定している。
 * アプリはメインループを持つ。
 */
export declare class DigitalInput<Action extends string> {
    private readonly pressedCodes;
    private readonly released;
    private readonly pushed;
    private readonly ac;
    private readonly disableReasons;
    private readonly config;
    private readonly codeToActions;
    private isPaused;
    pause(reason: string): void;
    resume(reason: string): void;
    constructor(config: Record<Action, readonly ConfigString[]>);
    /**
     * フレームの最後に呼び出す。
     */
    update(): void;
    private processGamepadInput;
    isPressed(action: Action): boolean;
    isReleased(action: Action): boolean;
    isPushed(action: Action): boolean;
    isSomethingPressed(): boolean;
    clear(): void;
    private isActionPressed;
    private onKeyDown;
    private onKeyUp;
    private press;
    private release;
}
