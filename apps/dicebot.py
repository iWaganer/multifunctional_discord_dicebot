
import discord
from discord import app_commands
import os
from dotenv import load_dotenv
import random
import re
import operator

load_dotenv()

DISCORD_TOKEN = os.getenv('dicebot_token')

# bot起動時の設定
client = discord.Client(intents=discord.Intents.all())
tree = app_commands.CommandTree(client)


# bot起動時の処理
@client.event
async def on_ready():
    print('ログインしました')
    await tree.sync()


# ダイスを振る関数
def roll_dice(num_of_dice, num_of_faces):
    results = []
    for _ in range(num_of_dice):
        result = random.randint(1, num_of_faces)
        results.append(result)
    return results


# ロールコマンドの前処理
def normalize_roll(roll):
    roll = roll.replace(' ', '').replace('　', '')

    replacements = {
        'D': 'd',
        'Ｄ': 'd',
        'ｄ': 'd',
        '＊': '*',
        '／': '/',
        '＋': '+',
        '－': '-',
        '−': '-',
        '·': '*',
        '・': '*',
        '﹡': '*',
        '⁎': '*',
        'x': '*',
        '×': '*',
        '÷': '/'
    }

    for before, after in replacements.items():
        roll = roll.replace(before, after)

    return roll


# 演算子の優先順位を考慮して計算
def calculate_expression(values, operators):
    total = 0
    current = values[0]
    sign = '+'

    for op, value in zip(operators, values[1:]):
        if op == '*':
            current *= value
        elif op == '/':
            current /= value
        else:
            total += current if sign == '+' else -current
            sign = op
            current = value

    total += current if sign == '+' else -current

    return total


# ダイス式の解析と計算
def evaluate_roll(roll):
    roll = normalize_roll(roll)

    # 演算子で分割
    parts = re.split(r'([+\-*/])', roll)
    elements = parts[::2]
    operators = parts[1::2]

    if not elements or any(not element for element in elements):
        raise ValueError("ロール形式が不正です")

    result_of_roll_show = []
    result_of_roll_calc = []

    # 各要素を計算
    for element in elements:
        if 'd' in element:
            if element.count('d') != 1:
                raise ValueError("ダイス形式が不正です")

            dice_count, face_count = element.split('d')

            num_of_dice = int(dice_count) if dice_count else 1
            num_of_faces = int(face_count)

            if not (1 <= num_of_dice <= 1000) or num_of_faces <= 0:
                raise ValueError("ダイスの個数または面数が不正です")

            roll_results = roll_dice(num_of_dice, num_of_faces)
            roll_total = sum(roll_results)

            result_of_roll_show.append(
                f"{roll_total}{roll_results}"
            )
            result_of_roll_calc.append(roll_total)

        else:
            value = int(element)
            result_of_roll_show.append(str(value))
            result_of_roll_calc.append(value)

    # 最終結果の計算
    final_result = calculate_expression(
        result_of_roll_calc, operators
    )

    # 表示用の式を組み立てる
    show_message = result_of_roll_show[0]

    for i, op in enumerate(operators):
        show_message += f" {op} {result_of_roll_show[i + 1]}"

    return final_result, show_message


# ロールコマンドの実装
@tree.command(name="dice_roll", description="ダイスと気がふれるぜ")
@app_commands.describe(
    roll="ロールを入力。()演算は非対応",
    than="上方下方判定",
    target="目標値",
    times="ロールを繰り返す回数（1～20回）"
)
async def dice_roll_command(
    interaction: discord.Interaction,
    roll: str,
    than: str = None,
    target: str = None,
    times: int = 1
):
    if interaction.user.bot:
        return

    print("ロールコマンドが実行されました")

    # 回数の確認
    if not 1 <= times <= 20:
        await interaction.response.send_message(
            "ロール回数は1～20回で指定してください。"
        )
        return

    # 上方下方判定用の演算子
    comparison_operators = {
        '>': operator.gt,
        '<': operator.lt,
        '>=': operator.ge,
        '<=': operator.le,
        '≧': operator.ge,
        '≦': operator.le,
        '=': operator.eq
    }

    if than in comparison_operators and target is None:
        await interaction.response.send_message(
            "上方下方判定には目標値を指定してください。"
        )
        return

    try:
        results = []

        # 指定回数だけロール
        for i in range(times):
            final_result, show_message = evaluate_roll(roll)

            print(f"{i + 1}回目: {show_message}")
            print(f"計算結果: {final_result}")

            # 上方下方判定
            if than in comparison_operators:
                target_value, _ = evaluate_roll(target)

                success = comparison_operators[than](
                    final_result, target_value
                )

                judge = "成功" if success else "失敗"

                final_result = (
                    f"{final_result} {than} {target_value} => {judge}"
                )

            # 結果を組み立てる
            if times == 1:
                result_message = f"[{show_message}] => {final_result}"
            else:
                result_message = (
                    f"{i + 1}回目: [{show_message}] => {final_result}"
                )

            results.append(result_message)

        # 結果をまとめて送信
        send_message = "\n".join(results)

        if len(send_message) > 2000:
            await interaction.response.send_message(
                "結果が長すぎます。ロール回数やダイスの個数を減らしてください。"
            )
            return

        await interaction.response.send_message(send_message)

    except Exception as e:
        await interaction.response.send_message(
            "ロールコマンドの形式が正しくありません。"
        )
        print(e)


# チョイスコマンドの実装
@tree.command(name="choice_roll", description="神よりせんたくをするぜ")
@app_commands.describe(
    choices="選択肢を空白かカンマで区切って入力",
    times="選択肢を選ぶ回数"
)
async def choice_command(
    interaction: discord.Interaction,
    choices: str,
    times: int = 1
):
    if interaction.user.bot:
        return

    print("チョイスコマンドが実行されました")
    send_message = ""

    try:
        choices_list = choices.split(',')

        if len(choices_list) == 1:
            choices_list = choices.split(' ')
        else:
            choices_list = choices.replace(' ', '').split(',')

        print(choices_list)

        for i in range(times):
            selected_choice = random.choice(choices_list)
            send_message += f"[{selected_choice}] "

        await interaction.response.send_message(send_message)

    except Exception as e:
        await interaction.response.send_message(
            "選択肢の形式が正しくありません。"
        )
        print(e)


client.run(DISCORD_TOKEN)
