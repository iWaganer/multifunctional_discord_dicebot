
import {
    verifyKey,
    InteractionType,
    InteractionResponseType
} from "discord-interactions";

import { calculateDice } from "./dice";
import { choose } from "./choice";

// Cloudflareに設定する環境変数
interface Env {
    DISCORD_PUBLIC_KEY: string;
}

// Discordから渡される引数
type CommandOption = {
    name: string;
    value?: string | number | boolean;
};

// Discordから送られるリクエストの構造
type DiscordInteraction = {
    type: number;
    data?: {
        name: string;
        options?: CommandOption[];
    };
};

const MAX_DICE_RUNS = 10;
const MAX_CHOICE_COUNT = 20;
const MAX_MESSAGE_LENGTH = 1900;

// 引数を名前で取得する
function getOption(options: CommandOption[], name: string) {
    return options.find(option => option.name === name)?.value;
}

// 実行回数・選択数を取得する
function getCount(options: CommandOption[], max: number): number {
    const count = getOption(options, "times") ?? 1;

    if (
        typeof count !== "number" ||
        !Number.isInteger(count) ||
        count < 1 ||
        count > max
    ) {
        throw new Error(`回数は1～${max}の整数にしてください`);
    }

    return count;
}

// Discordにメッセージを返す
function reply(content: string): Response {
    if (content.length > MAX_MESSAGE_LENGTH) {
        content = "結果が長すぎます。実行回数を減らしてください。";
    }

    return Response.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content,
            allowed_mentions: { parse: [] }
        }
    });
}

// コマンドごとの処理
function executeCommand(
    name: string,
    options: CommandOption[]
): string {
    switch (name) {
        case "dice_roll": {
            const roll = getOption(options, "roll");
            const times = getCount(options, MAX_DICE_RUNS);

            if (typeof roll !== "string" || roll.length === 0) {
                throw new Error("計算式を入力してください");
            }

            const results: string[] = [];

            for (let i = 0; i < times; i++) {
                const result = calculateDice(roll);
                results.push(`[${result.display}] => ${result.value}`);
            }

            return results.join("\n");
        }

        case "choice_roll": {
            const choices = getOption(options, "choices");
            const count = getCount(options, MAX_CHOICE_COUNT);
            const duplicates = getOption(options, "allow_duplicates");

            if (typeof choices !== "string" || choices.length === 0) {
                throw new Error("選択肢を入力してください");
            }

            if (
                duplicates !== undefined &&
                typeof duplicates !== "boolean"
            ) {
                throw new Error("重複設定が不正です");
            }

            const results = choose(
                choices,
                count,
                duplicates ?? true
            );

            return results.map(result => `[${result}]`).join(" ");
        }

        default:
            return "未対応のコマンドです";
    }
}

// Cloudflare Workersの入口
export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        // DiscordはPOSTで送信してくる
        if (request.method !== "POST") {
            return new Response("Method Not Allowed", { status: 405 });
        }

        // リクエストから署名情報を取得
        const signature = request.headers.get("X-Signature-Ed25519") ?? "";
        const timestamp = request.headers.get("X-Signature-Timestamp") ?? "";
        const body = await request.text();

        // 本当にDiscordから送られた通信か検証
        const valid = await verifyKey(
            body,
            signature,
            timestamp,
            env.DISCORD_PUBLIC_KEY
        );

        if (!valid) {
            return new Response("Invalid signature", { status: 401 });
        }

        let interaction: DiscordInteraction;

        try {
            interaction = JSON.parse(body) as DiscordInteraction;
        } catch {
            return new Response("Invalid JSON", { status: 400 });
        }

        // Discordからの接続確認
        if (interaction.type === InteractionType.PING) {
            return Response.json({
                type: InteractionResponseType.PONG
            });
        }

        // スラッシュコマンド以外には対応しない
        if (interaction.type !== InteractionType.APPLICATION_COMMAND) {
            return new Response("Unsupported interaction", { status: 400 });
        }

        const name = interaction.data?.name ?? "";
        const options = interaction.data?.options ?? [];

        try {
            const result = executeCommand(name, options);
            return reply(result);
        } catch (error) {
            const message = error instanceof Error
                ? error.message
                : "不明なエラーが発生しました";

            return reply(`エラー: ${message}`);
        }
    }
};
