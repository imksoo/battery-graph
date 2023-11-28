import AxiosDigestAuth from '@mhoc/axios-digest-auth';
import env from 'dotenv';

// AiSEG2のURLとユーザー名、パスワードを指定
const baseUrl = env.config().parsed?.AISEG2_BASE_URL || 'http://' + env.config().parsed?.AISEG2_IP_ADDRESS + ':80';
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

async function main() {
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

  console.log('太陽光発電の発電量: ', powerGenerated.toFixed(1), 'kWh');
  console.log('電力系統への買電量: ', powerFromGrid.toFixed(1), 'kWh');
  console.log('電力系統への売電量: ', soldPowerToGrid.toFixed(1), 'kWh');
  console.log('利用電力量(計測値): ', usedPower.toFixed(1), 'kWh');
  console.log('差し引き推定蓄電量: ', ((powerGenerated + powerFromGrid) - (soldPowerToGrid + usedPower)).toFixed(1), 'kWh');
  console.log('蓄電池 残パーセント: ', batteryPercentage.toFixed(0), '%');
  console.log('蓄電池 放電可能な電力量: ', (((batteryPercentage - batteryLowLimit) * batteryCapacity) / 100).toFixed(1), 'kWh');
}

main();