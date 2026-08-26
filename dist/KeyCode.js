export var SourceKey;
(function (SourceKey) {
    /**
     * Sourceを一意な文字列に変換する。Sourceはオブジェクトなので参照ではなく値で同一性を
     * 判定したい場面（Set/Mapのキーにする、重複判定する等）で使う。
     */
    function toKey(source) {
        switch (source.type) {
            case "keyboard":
                return `keyboard:${source.code}`;
            case "gamepad-button":
                return `gamepad-button:${source.index}`;
            case "gamepad-axis":
                return `gamepad-axis:${source.index}:${source.direction}`;
        }
    }
    SourceKey.toKey = toKey;
    function equals(a, b) {
        return toKey(a) === toKey(b);
    }
    SourceKey.equals = equals;
})(SourceKey || (SourceKey = {}));
