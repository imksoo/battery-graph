# ニチコンの蓄電池の情報をパナソニックAiSEG2経由で取り出すプログラム

## .env ファイルの書き方

```.env
AISEG2_IP_ADDRESS=AiSEG2のIPアドレス
AISEG2_USERNAME=AiSEG2のログインユーザー名(デフォルトだと空文字)
AISEG2_PASSWORD=AiSEG2のログインパスワード(デフォルトだと製造番号)
BATTERY_CAPACITY=ニチコンの蓄電池の最大容量(kWh)
BATTERY_LOW_LIMIT=蓄電池の放電制限パーセンテージ(デフォルトは30%)
```
