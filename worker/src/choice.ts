export function choose(
    choices: string,
    count: number = 1,
    allowDuplicates: boolean = true
): string[] {
    const input = choices
        .replace(/，/g, ",")
        .replace(/、/g, ",")
        .replace(/　/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (input.length === 0 || input.length > 1000) {
        throw new Error("選択肢が空、または長すぎます");
    }

    // 選択肢の分割
    const options = (input.includes(",")
        ? input.split(",")
        : input.split(" "))
        .map(option => option.trim())
        .filter(option => option.length > 0);

    // 入力値の検証
    if (options.length === 0 || options.length > 1000) {
        throw new Error("選択肢の数は1～1000個にしてください");
    }

    if (!Number.isInteger(count) || count < 1 || count > 1000) {
        throw new Error("抽選回数は1～1000の整数にしてください");
    }

    // 重複なしの場合、同じ選択肢を除去する
    const pool = allowDuplicates
        ? options
        : [...new Set(options)];

    if (!allowDuplicates && count > pool.length) {
        throw new Error("選択数が選択肢の数を超えています");
    }

    // 抽選
    const results: string[] = [];

    for (let i = 0; i < count; i++) {
        const index = Math.floor(Math.random() * pool.length);

        results.push(pool[index]);

        if (!allowDuplicates) {
            pool.splice(index, 1);
        }
    }

    return results;
}