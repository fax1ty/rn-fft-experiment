import LiveAudioStream from "@fugood/react-native-audio-pcm-stream";
import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { usePermissions, AUDIO_RECORDING } from "expo-permissions";
import { ifft, fft } from "ezfft";
import math from "mathjs";
import { useAssets } from "expo-asset";
import RNFetchBlob from "rn-fetch-blob";
import base64 from "base-64";

const SAMPLE_RATE = 32000;

const fillUp = (a: number[], N: number) => [
  ...a,
  ...new Array<number>(N - a.length).fill(0),
];

const conv = (a: Uint8Array, b: Uint8Array) => {
  const FFTa = fft(Array.from(a), SAMPLE_RATE);
  // const FFTb = fft(Array.from(b), 44100); // потому что B - идеал, запсан в 44.1 кГц

  const N = a.length + b.length - 1;

  console.log(
    FFTa.frequency.frequency.length,
    // FFTb.frequency.frequency.length,
    N
  );

  // const A = math.multiply(
  //   fillUp(FFTa.frequency.amplitude, N),
  //   fillUp(FFTb.frequency.amplitude, N)
  // );
  // const F = math.multiply(
  //   fillUp(FFTa.frequency.frequency, N),
  //   fillUp(FFTb.frequency.frequency, N)
  // );

  // return ifft(A, F);
};

const toComplexArray = (data: string) => {
  const binary_string = base64.decode(data);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
};

export default function () {
  const [permissions, requestPermissions] = usePermissions(AUDIO_RECORDING);
  const [b, setB] = useState<Uint8Array>();
  const [assets, error] = useAssets([require("./assets/ideal.pcm")]);

  useEffect(() => {
    if (!assets) return;
    if (b) return;

    if (error)
      return console.error("Ассеты не загрузились. Что-то пошло не так");

    (async () => {
      const url = assets[0].uri;

      try {
        // Потому что великая команда RN не удосужилась до сих пор добавить нативную поддержку ArrayBuffer для fetch
        const response = await RNFetchBlob.fetch("GET", url);
        setB(toComplexArray(response.base64()));
      } catch (error) {
        console.error("Не получилось преобразовать файл в буфер", url, error);
      }
    })();
  }, [b, assets]);

  useEffect(() => {
    if (!permissions?.granted) requestPermissions();
  }, [permissions]);

  useEffect(() => {
    if (!permissions?.granted) return;
    if (!b) return;

    const bufferSize = 4096;

    LiveAudioStream.init({
      sampleRate: SAMPLE_RATE,
      channels: 1,
      bitsPerSample: 16,
      audioSource: 0,
      bufferSize,
    });
    LiveAudioStream.on("data", (chunk: string) => {
      console.log("data");

      const d1 = Date.now();
      const a = toComplexArray(chunk);
      const similarity = conv(a, b);
      const d2 = Date.now();
      console.log(d2 - d1);
    });
    LiveAudioStream.start();

    return () => void LiveAudioStream.stop();
  }, [permissions, b]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>
        {!permissions?.granted
          ? "Просим права..."
          : "Всё готово. Записываем..."}
      </Text>
    </View>
  );
}
