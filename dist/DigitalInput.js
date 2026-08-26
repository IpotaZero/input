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
    gamepadIndex;
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
    }
    resume(reason) {
        this.disableReasons.delete(reason);
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
    constructor(config, gamepadIndex = [0, 1, 2, 3]) {
        this.gamepadIndex = gamepadIndex;
        this.updateConfig(config);
        window.addEventListener("keydown", this.onKeyDown, { signal: this.ac.signal });
        window.addEventListener("keyup", this.onKeyUp, { signal: this.ac.signal });
    }
    /**
     * 毎フレーム、呼び出し元(アプリのメインループ)から呼ぶ。呼び出し元が何をしていようと関係なく必ず呼ばれる、という点がポイント。
     *
     * ゲームパッドはkeydown/keyupのようなイベントを持たないため、ここでのポーリングでしか状態を
     * 検知できない。isPressed()等の呼び出しタイミングに便乗して更新する方式だと、呼び出し側が
     * しばらく呼んでくれない期間(pause中など)に状態追跡が完全に止まってしまい、その間の押下/解放を
     * 取りこぼした結果、後から辻褄が合わなくなる(新規pushの誤検知など)。
     * ここで一元的に、呼び出し側の都合に依存せず毎フレーム確実にポーリングすることで、
     * キーボードのイベントリスナーと同じく「物理的な状態変化と同期してpress()/release()が呼ばれる」
     * という性質になり、キーボードとゲームパッドの挙動を一致させられる。
     */
    update() {
        this.pushed.clear();
        this.released.clear();
        this.updateGamepadState();
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
        return this.isActionPressed(action);
    }
    /**ちょうどこのフレームに離されたか? */
    isReleased(action) {
        if (this.isPaused())
            return false;
        return this.released.has(action);
    }
    /**ちょうどこのフレームに押されたか? */
    isPushed(action) {
        if (this.isPaused())
            return false;
        return this.pushed.has(action);
    }
    isSomethingPressed() {
        if (this.isPaused())
            return false;
        return this.pressedCodes.size > 0;
    }
    isSomethingPushed() {
        if (this.isPaused())
            return false;
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
    isRepeatPushed(action, intervalMs = 100, initialDelayMs = 400) {
        if (this.isPaused())
            return false;
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
        if (!this.codeToActions.has(e.code))
            return;
        this.press(e.code);
    };
    onKeyUp = (e) => {
        if (!this.codeToActions.has(e.code))
            return;
        this.release(e.code);
    };
    /**
     * 新規にコードが押されたことを記録する。pause中は「新規に押される」ことだけを無視する
     * (例: キーコンフィグの入力待ち中に、たまたま別のキーが押されてもゲーム側の入力として扱わない)。
     * 一方releaseはpause中でも常に反映する。そうしないと、pauseした瞬間にたまたま押されていた
     * キー/ボタンが、pause中に離されたことを検知できずに「押されっぱなし」のまま固まってしまい、
     * resume後にそのキー/ボタンが二度と反応しなくなる (または離すまで別の入力として誤検知され続ける)。
     *
     * pause中でも物理的な押下状態そのもの(pressedCodes)は必ず記録する。キーボードのkeydown、
     * ゲームパッドのポーリング(update()内のupdateGamepadState())ともに、pause中かどうかに
     * 関わらずこのpress()自体は呼ばれ続けるので、ここで記録を止めてしまうとpause解除時に
     * 「押されっぱなしのボタン」を新規pushとして誤検知することになる。
     */
    press(code) {
        if (this.pressedCodes.has(code))
            return;
        if (!this.isPaused()) {
            const actions = this.codeToActions.get(code);
            if (actions) {
                for (const action of actions) {
                    // 他のコード経由で既に押されている場合は「新規に押された」扱いにしない
                    if (!this.isActionPressed(action)) {
                        this.pushed.add(action);
                    }
                }
            }
        }
        this.pressedCodes.add(code);
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
        navigator.getGamepads().forEach((gamepad, index) => {
            if (!this.gamepadIndex.includes(index))
                return;
            if (!gamepad)
                return;
            this.processGamepadInput(gamepad);
        });
    }
}
