import AxiosDigestAuth from '@mhoc/axios-digest-auth';
import { InfluxDB, Point } from '@influxdata/influxdb-client';
import env from 'dotenv';

// AiSEG2のURLとユーザー名、パスワードを指定
const baseUrl = 'http://' + env.config().parsed?.AISEG2_IP_ADDRESS + ':80';
const username = env.config().parsed?.AISEG2_USERNAME || '';
const password = env.config().parsed?.AISEG2_PASSWORD || '';
const batteryCapacity = Number.parseFloat(env.config().parsed?.BATTERY_CAPACITY || "16.6");
const batteryLowLimit = Number.parseFloat(env.config().parsed?.BATTERY_LOW_LIMIT || "30");

async function getTotalValueFromAiSEG2(url: string, username: string, password: string): Promise<number | null> {
  const digestAuth = new AxiosDigestAuth({ username, password });

  try {
    const response = await digestAuth.request({ method: 'GET', url: url });

    const body = response.data;
    const regex = /"totalValue":"([0-9\.]+)"/;
    const matches = regex.exec(body);

    if (matches && matches[1]) {
      return Number.parseFloat(matches[1]);
    }
  } catch (error) {
    console.error(error);
  }
  return null;
}

async function getBatteryPercentageFromAiSEG2(url: string, username: string, password: string): Promise<number | null> {
  const digestAuth = new AxiosDigestAuth({ username, password });

  try {
    const response = await digestAuth.request({ method: 'POST', url: url });

    const json_data = JSON.parse(JSON.stringify(response.data));
    if (json_data && json_data.percent) {
      return json_data.percent;
    }
  } catch (error) {
    console.error(error);
  }
  return null;
}

/// メイン処理
/// @param writeInfluxDB InfluxDBに書き込むかどうか
async function main(writeInfluxDB: boolean = false) {
  // 発電量の値を取得
  const powerGenerated = await getTotalValueFromAiSEG2(`${baseUrl}/page/graph/51111`, username, password) || 0;
  // 買電量の値を取得
  const powerFromGrid = await getTotalValueFromAiSEG2(`${baseUrl}/page/graph/53111`, username, password) || 0;
  // 売電量の値を取得
  const soldPowerToGrid = await getTotalValueFromAiSEG2(`${baseUrl}/page/graph/54111`, username, password) || 0;
  // 使用電力量の値を取得
  const usedPower = await getTotalValueFromAiSEG2(`${baseUrl}/page/graph/52111`, username, password) || 0;
  // 蓄電量の残量を取得
  const batteryPercentage = await getBatteryPercentageFromAiSEG2(`${baseUrl}/data/electricflow/111/update`, username, password) || 0;

  // 差し引き推定蓄電量を計算
  const estimatedCapacity = (powerGenerated + powerFromGrid) - (soldPowerToGrid + usedPower);
  // 蓄電池の放電可能な電力量を計算
  const remainingCapacity = ((batteryPercentage - batteryLowLimit) * batteryCapacity) / 100;

  // 結果をコンソールに出力
  console.log("--------------------------------------------------");
  console.log('現在時刻: ', new Date().toLocaleString());
  console.log('太陽光発電の発電量: ', powerGenerated.toFixed(1), 'kWh');
  console.log('電力系統への買電量: ', powerFromGrid.toFixed(1), 'kWh');
  console.log('電力系統への売電量: ', soldPowerToGrid.toFixed(1), 'kWh');
  console.log('利用電力量(計測値): ', usedPower.toFixed(1), 'kWh');
  console.log('差し引き推定蓄電量: ', estimatedCapacity.toFixed(1), 'kWh');
  console.log('蓄電池 残パーセント: ', batteryPercentage.toFixed(0), '%');
  console.log('蓄電池 放電可能な電力量: ', remainingCapacity.toFixed(1), 'kWh');

  // InfluxDBが設定されている場合は、InfluxDBに書き込み
  if (writeInfluxDB) {
    // InfluxDBとの接続
    const influxDbClient = new InfluxDB({ url: env.config().parsed?.INFLUXDB_URL || '', token: env.config().parsed?.INFLUXDB_TOKEN || '' });
    const influxOrg = env.config().parsed?.INFLUXDB_ORG || '';
    const influxBucket = env.config().parsed?.INFLUXDB_BUCKET || '';
    const influxWriter = influxDbClient.getWriteApi(influxOrg, influxBucket, 's')

    influxWriter.writePoint(
      new Point('battery')
        .floatField('powerGenerated', powerGenerated)
        .floatField('powerFromGrid', powerFromGrid)
        .floatField('soldPowerToGrid', soldPowerToGrid)
        .floatField('usedPower', usedPower)
        .floatField('estimatedCapacity', estimatedCapacity)
        .floatField('batteryPercentage', batteryPercentage)
        .floatField('remainingCapacity', remainingCapacity)
    )
    influxWriter.flush();
    influxWriter.close();
  }
}

// 初回実行
main();

// InfluxDBが設定されている場合は、1分ごとに実行してInfluxDBに書き込み
if (env.config().parsed?.INFLUXDB_URL) {
  setInterval(() => { main(true) }, 1000 * 60);
}
