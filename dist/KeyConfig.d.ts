import type { Source } from "./KeyCode";
export declare namespace KeyConfig {
    type Options = {
        /** ゲームパッドの軸をpressedとみなす閾値の絶対値 (デフォルト0.5) */
        axisThreshold?: number;
        /** ゲームパッドのボタンをpressedとみなす閾値 (デフォルト0.5) */
        buttonThreshold?: number;
        /** これがabortされると待機を中断し、Promiseはreject(AbortError)される */
        signal?: AbortSignal;
    };
}
/**
 * キーコンフィグ画面向け: キーボードまたはゲームパッドで何らかの入力が行われるまで待ち、
 * 押された入力に対応する Source (DigitalInput.Configにそのまま使える) を返す。
 * AnalogInputのConfigに使う場合は、返り値を各Source型（threshold等を追加可能）に変換して使うこと。
 *
 * - キーボードは keydown イベントで検知する (KeyCode.ts の keys 一覧に含まれるコードのみ)。
 * - ゲームパッドはボタン押下イベントを持たないため、rAFで毎フレームポーリングする。
 *   呼び出し時点で既に押されている/倒されているボタン・軸は「呼び出し前からの入力」とみなして無視し、
 *   一度離れてから新たに閾値を超えたものだけを「入力された」として検知する。
 *   (こうしないと、ユーザーがボタンを押しっぱなしのままこの関数を呼んだ瞬間に即resolveしてしまう)
 *
 * @example
 * const code = await KeyConfig.waitForAnyInput()
 * config[action] = [...config[action], code]
 */
export declare namespace KeyConfig {
    function waitForAnyInput(options?: KeyConfig.Options): Promise<Source>;
    /**
     * 指定された Source (キー/ボタン/軸) が物理的に離されるまで待つ
     */
    function waitForRelease(source: Source, options?: KeyConfig.Options): Promise<void>;
}
