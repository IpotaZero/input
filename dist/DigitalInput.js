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
export class DigitalInput {
    // 実際に押されているキーコード/ゲームパッドコードの集合
    // （アクション単位ではなくコード単位で保持することで、
    //   同じアクションに複数のコードが割り当てられているときに
    //   片方を離しただけでアクション全体がOFFになるのを防ぐ）
    pressedCodes = new Set();
    // こちらは従来通りアクション単位の「今フレームで新たに押された/離された」エッジ集合
    released = new Set();
    pushed = new Set();
    // isRepeatPushed用: アクションごとに「次にパルスを発生させる時刻」を保持する
    repeatNextFireAt = new Map();
    ac = new AbortController();
    disableReasons = new Set();
    config = new Map();
    codeToActions = new Map();
    isPaused() {
        return this.disableReasons.size > 0;
    }
    pause(reason) {
        this.disableReasons.add(reason);
        console.log("DigitalInput is paused because of reasons:", this.disableReasons);
    }
    resume(reason) {
        this.disableReasons.delete(reason);
        console.log("DigitalInput is paused because of reasons:", this.disableReasons);
    }
    updateConfig(config) {
        this.config.clear();
        this.codeToActions.clear();
        const entries = Object.entries(config);
        for (const [action, codes] of entries) {
            this.config.set(action, [...codes]);
            for (const code of codes) {
                const actions = this.codeToActions.get(code) ?? [];
                actions.push(action);
                this.codeToActions.set(code, actions);
            }
        }
    }
    constructor(config) {
        this.updateConfig(config);
        window.addEventListener("keydown", this.onKeyDown, { signal: this.ac.signal });
        window.addEventListener("keyup", this.onKeyUp, { signal: this.ac.signal });
    }
    /**
     * フレームの最後に呼び出す。
     */
    update() {
        this.pushed.clear();
        this.released.clear();
    }
    dispose() {
        this.ac.abort();
    }
    processGamepadInput(gamepad) {
        gamepad.buttons.forEach((button, index) => {
            const code = `gamepad-button-${index}`;
            if (!this.codeToActions.has(code))
                return;
            if (button.pressed) {
                this.press(code);
            }
            else {
                this.release(code);
            }
        });
        gamepad.axes.forEach((axis, index) => {
            const positiveCode = `gamepad-axis-${index}-positive`;
            const negativeCode = `gamepad-axis-${index}-negative`;
            if (!this.codeToActions.has(positiveCode) && !this.codeToActions.has(negativeCode))
                return;
            if (axis > 0.5) {
                this.press(positiveCode);
                this.release(negativeCode);
            }
            else if (axis < -0.5) {
                this.press(negativeCode);
                this.release(positiveCode);
            }
            else {
                this.release(positiveCode);
                this.release(negativeCode);
            }
        });
    }
    /**押されているか? */
    isPressed(action) {
        if (this.isPaused())
            return false;
        this.updateGamepadState();
        return this.isActionPressed(action);
    }
    /**ちょうどこのフレームに離されたか? */
    isReleased(action) {
        if (this.isPaused())
            return false;
        this.updateGamepadState();
        return this.released.has(action);
    }
    /**ちょうどこのフレームに押されたか? */
    isPushed(action) {
        if (this.isPaused())
            return false;
        this.updateGamepadState();
        return this.pushed.has(action);
    }
    isSomethingPressed() {
        if (this.isPaused())
            return false;
        this.updateGamepadState();
        return this.pressedCodes.size > 0;
    }
    isSomethingPushed() {
        if (this.isPaused())
            return false;
        this.updateGamepadState();
        return this.pushed.size > 0;
    }
    /**
     * 押しっぱなしの間、一定間隔(intervalMs)ごとにtrueを返す(いわゆるキーリピート/オートリピート)。
     * 「ガ・ガガガガガ」のように、最初の1発はinitialDelayMs後、以降はintervalMsごとに発生する。
     *
     * 例: isRepeatPushed("attack", 100, 400)
     *   → 押した瞬間に1回true、その400ms後にもう1回true、以降100ms間隔でtrueを返し続ける
     *
     * 毎フレーム呼び出して使うこと。離す/他のコードで押され続けていない状態になるとリセットされる。
     */
    isRepeatPushed(action, intervalMs, initialDelayMs = intervalMs) {
        if (this.isPaused())
            return false;
        this.updateGamepadState();
        if (!this.isActionPressed(action)) {
            this.repeatNextFireAt.delete(action);
            return false;
        }
        const now = performance.now();
        const nextFireAt = this.repeatNextFireAt.get(action);
        // 新規プレス(このメソッドとしては初回)なので最初の「ガ」を発生させる
        if (nextFireAt === undefined) {
            this.repeatNextFireAt.set(action, now + initialDelayMs);
            return true;
        }
        if (now >= nextFireAt) {
            this.repeatNextFireAt.set(action, now + intervalMs);
            return true;
        }
        return false;
    }
    clear() {
        this.pressedCodes.clear();
        this.released.clear();
        this.pushed.clear();
        this.repeatNextFireAt.clear();
    }
    // アクションに割り当てられたコードのうち、どれか一つでも
    // 押されていればそのアクションは「押されている」とみなす
    isActionPressed(action) {
        const codes = this.config.get(action);
        if (!codes)
            return false;
        return codes.some((code) => this.pressedCodes.has(code));
    }
    onKeyDown = (e) => {
        if (this.isPaused())
            return;
        if (!this.codeToActions.has(e.code))
            return;
        this.press(e.code);
    };
    onKeyUp = (e) => {
        if (this.isPaused())
            return;
        if (!this.codeToActions.has(e.code))
            return;
        this.release(e.code);
    };
    press(code) {
        if (this.pressedCodes.has(code))
            return;
        const actions = this.codeToActions.get(code);
        if (actions) {
            for (const action of actions) {
                // 他のコード経由で既に押されている場合は「新規に押された」扱いにしない
                if (!this.isActionPressed(action)) {
                    this.pushed.add(action);
                }
            }
        }
        this.pressedCodes.add(code);
        console.log(this.pushed);
    }
    release(code) {
        if (!this.pressedCodes.has(code))
            return;
        this.pressedCodes.delete(code);
        const actions = this.codeToActions.get(code);
        if (actions) {
            for (const action of actions) {
                // 他のコードがまだ押されている場合はアクションとしてはまだ押された状態を維持する
                if (!this.isActionPressed(action)) {
                    this.released.add(action);
                }
            }
        }
    }
    updateGamepadState() {
        navigator
            .getGamepads()
            ?.filter((gamepad) => !!gamepad)
            .forEach((gamepad) => this.processGamepadInput(gamepad));
    }
}
