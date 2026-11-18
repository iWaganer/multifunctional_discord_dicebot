export type CalcResult = {
    value: number | "成功" | "失敗";
    display: string;
};

type CompareOperator = "<" | ">" | "<=" | ">=" | "=";

export function calculateDice(expression: string): CalcResult {
    const input = expression
        .replace(/[\s　]/g, "")
        .replace(/[DＤｄ]/g, "d")
        .replace(/＋/g, "+")
        .replace(/[－−]/g, "-")
        .replace(/[＊×·・﹡⁎]/g, "*")
        .replace(/[／÷]/g, "/")
        .replace(/[≦≤]/g, "<=")
        .replace(/[≧≥]/g, ">=")
        .replace(/＜/g, "<")
        .replace(/＞/g, ">")
        .replace(/[＝＝=]/g, "=");

    let pos = 0;
    let totalDice = 0;

    if (input.length === 0 || input.length > 300) {
        throw new Error("式が空、または長すぎます");
    }

    function makeResult(value: number, display: string): CalcResult {
        if (!Number.isFinite(value)) {
            throw new Error("計算結果が不正です");
        }
        return { value, display };
    }

    function getNumber(result: CalcResult): number {
        if (typeof result.value !== "number") {
            throw new Error("比較結果は数値の演算に使用できません");
        }
        return result.value;
    }

    // 比較演算子を読み取る
    function readComparator(): CompareOperator | null {
        if (input.startsWith("<=", pos)) {
            pos += 2;
            return "<=";
        }
        if (input.startsWith(">=", pos)) {
            pos += 2;
            return ">=";
        }
        if (input.startsWith("=", pos)) {
            pos++;
            return "=";
        }
        if (input[pos] === "<" || input[pos] === ">") {
            return input[pos++] as CompareOperator;
        }
        return null;
    }

    // 2つの数値を比較する
    function compare(a: number, operator: CompareOperator, b: number): boolean {
        switch (operator) {
            case "<":  return a < b;
            case ">":  return a > b;
            case "<=": return a <= b;
            case ">=": return a >= b;
            case "=":  return a === b;
        }
    }

    // 比較演算子は最も優先順位が低い
    function parseComparison(): CalcResult {
        let left = parseExpression();
        let hasComparison = false;
        let success = true;
        let display = "";

        while (true) {
            const operator = readComparator();
            if (operator === null) break;

            const leftValue = getNumber(left);
            const right = parseExpression();
            const rightValue = getNumber(right);

            if (!hasComparison) {
                display = `${left.display} (=${leftValue})`;
                hasComparison = true;
            }

            display += ` ${operator} ${right.display} (=${rightValue})`;

            if (!compare(leftValue, operator, rightValue)) {
                success = false;
            }

            left = right;
        }

        if (!hasComparison) return left;

        return {
            value: success ? "成功" : "失敗",
            display
        };
    }

    // 足し算・引き算
    function parseExpression(): CalcResult {
        let left = parseTerm();

        while (input[pos] === "+" || input[pos] === "-") {
            const operator = input[pos++];
            const right = parseTerm();

            const leftValue = getNumber(left);
            const rightValue = getNumber(right);

            left = makeResult(
                operator === "+"
                    ? leftValue + rightValue
                    : leftValue - rightValue,
                `${left.display}${operator}${right.display}`
            );
        }

        return left;
    }

    // 掛け算・割り算
    function parseTerm(): CalcResult {
        let left = parseUnary();

        while (input[pos] === "*" || input[pos] === "/") {
            const operator = input[pos++];
            const right = parseUnary();

            const leftValue = getNumber(left);
            const rightValue = getNumber(right);

            if (operator === "/" && rightValue === 0) {
                throw new Error("0では割れません");
            }

            left = makeResult(
                operator === "*"
                    ? leftValue * rightValue
                    : leftValue / rightValue,
                `${left.display}${operator}${right.display}`
            );
        }

        return left;
    }

    // 正負の符号
    function parseUnary(): CalcResult {
        if (input[pos] === "+" || input[pos] === "-") {
            const sign = input[pos++];
            const result = parseUnary();

            return makeResult(
                sign === "-" ? -getNumber(result) : getNumber(result),
                `${sign}${result.display}`
            );
        }

        return parseDice();
    }

    // ダイス計算
    function parseDice(): CalcResult {
        const left = input[pos] === "d"
            ? makeResult(1, "1")
            : parsePrimary();

        if (input[pos] !== "d") return left;

        pos++;
        const right = parsePrimary();

        const count = getNumber(left);
        const faces = getNumber(right);

        if (!Number.isSafeInteger(count) || count < 1 || count > 100) {
            throw new Error("ダイスの個数は1～100の整数にしてください");
        }

        if (!Number.isSafeInteger(faces) || faces < 1 || faces > 1000) {
            throw new Error("ダイスの面数は1～1000の整数にしてください");
        }

        if (totalDice + count > 200) {
            throw new Error("ダイスの合計個数が多すぎます");
        }

        totalDice += count;

        const rolls: number[] = [];

        for (let i = 0; i < count; i++) {
            rolls.push(Math.floor(Math.random() * faces) + 1);
        }

        const sum = rolls.reduce((total, roll) => total + roll, 0);

        return makeResult(sum, `${sum}(${rolls.join(",")})`);
    }

    // 数字・括弧
    function parsePrimary(): CalcResult {
        if (input[pos] === "(") {
            pos++;

            const inner = parseComparison();

            if (input[pos] !== ")") {
                throw new Error("閉じ括弧がありません");
            }

            pos++;

            return {
                value: inner.value,
                display: `(${inner.display})`
            };
        }

        return parseNumber();
    }

    // 数字を読み取る
    function parseNumber(): CalcResult {
        const start = pos;

        while (pos < input.length && /[0-9]/.test(input[pos])) {
            pos++;
        }

        if (input[pos] === ".") {
            pos++;

            while (pos < input.length && /[0-9]/.test(input[pos])) {
                pos++;
            }
        }

        const text = input.slice(start, pos);

        if (!/^\d+(?:\.\d+)?$/.test(text)) {
            throw new Error(`位置${start + 1}に数字が必要です`);
        }

        return makeResult(Number(text), text);
    }

    // 解析開始
    const result = parseComparison();

    if (pos !== input.length) {
        throw new Error(`位置${pos + 1}に解釈できない文字があります`);
    }

    return result;
}
