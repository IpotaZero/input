/**
 * touchTracker.ts
 * 指でHTML要素をなぞったとき、毎フレームの指の移動量(px)を計測する。
 *
 * - rAFループは呼び出し側が管理する
 * - getDelta() を毎フレーム呼ぶことで、前フレームからの変化量を取得する
 * - AbortController はクラス内部で保持し、remove() で一括解除する
 */

export namespace TouchTracker {
    export interface Delta {
        x: number // X軸方向の移動量 (px)
        y: number // Y軸方向の移動量 (px)
    }
}

export class TouchTracker {
    private readonly ac = new AbortController()

    // touchmove で随時上書きされる「最新」の座標
    private latestX: number | null = null
    private latestY: number | null = null

    // getDelta() 呼び出しごとに更新される「前フレーム時点」の座標
    private prevX: number | null = null
    private prevY: number | null = null

    constructor(element: HTMLElement) {
        const { signal } = this.ac

        element.addEventListener(
            "touchstart",
            (e: TouchEvent) => {
                const t = e.touches[0]
                this.prevX = this.latestX = t.clientX
                this.prevY = this.latestY = t.clientY
            },
            { passive: true, signal },
        )

        element.addEventListener(
            "touchmove",
            (e: TouchEvent) => {
                const t = e.touches[0]
                this.latestX = t.clientX
                this.latestY = t.clientY
            },
            { passive: true, signal },
        )

        element.addEventListener("touchend", this.clearState, { signal })
        element.addEventListener("touchcancel", this.clearState, { signal })
    }

    /**
     * 前回 getDelta() を呼んだ時点からの移動量を返す。
     * タッチ中でなければ null。
     * 毎フレーム(rAFループ内)で呼ぶことを想定している。
     */
    getDelta(): TouchTracker.Delta | null {
        const { latestX, latestY, prevX, prevY } = this

        if (latestX === null || latestY === null || prevX === null || prevY === null) {
            return null
        }

        const dx = latestX - prevX
        const dy = latestY - prevY

        // 次フレームの基点を更新
        this.prevX = latestX
        this.prevY = latestY

        return { x: dx, y: dy }
    }

    /** イベントリスナーを一括解除してリソースを解放する */
    dispose(): void {
        this.ac.abort()
        this.clearState()
    }

    private readonly clearState = (): void => {
        this.prevX = this.prevY = this.latestX = this.latestY = null
    }
}
