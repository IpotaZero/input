/**
 * touchTracker.ts
 * 指でHTML要素をなぞったとき、毎フレームの指の移動量(px)を計測する。
 *
 * - rAFループは呼び出し側が管理する
 * - getDelta() を毎フレーム呼ぶことで、前フレームからの変化量を取得する
 * - AbortController はクラス内部で保持し、remove() で一括解除する
 */
export declare namespace TouchTracker {
    interface Delta {
        x: number;
        y: number;
    }
}
export declare class TouchTracker {
    private readonly ac;
    private latestX;
    private latestY;
    private prevX;
    private prevY;
    constructor(element: HTMLElement);
    /**
     * 前回 getDelta() を呼んだ時点からの移動量を返す。
     * タッチ中でなければ null。
     * 毎フレーム(rAFループ内)で呼ぶことを想定している。
     */
    getDelta(): TouchTracker.Delta | null;
    /** イベントリスナーを一括解除してリソースを解放する */
    dispose(): void;
    private readonly clearState;
}
