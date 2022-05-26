/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import React, { useEffect, useState } from 'react';

import BleManager from 'react-native-ble-manager';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import { DFUEmitter, NordicDFU } from 'react-native-nordic-dfu';

import {
  Box,
  Button,
  ScrollView,
  Typography,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { onekeyBleConnect } from '@onekeyhq/kit/src/utils/ble/BleOnekeyConnect';
import deviceUtils, { BleDevice } from '@onekeyhq/kit/src/utils/ble/utils';
import { get, set } from '@onekeyhq/kit/src/utils/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

BleManager.start({ showAlert: false }).then(() => {
  // Success code
  console.log('Module initialized');
});

export const DFU = () => {
  const [connectedDevice, setConnectedDevice] = useState<BleDevice | null>(
    null,
  );
  const [devices, setDevices] = useState<BleDevice[]>([]);
  const [features, setFeatures] = useState<any>();
  const [uri, setUri] = useState('');
  const [progress, setProgress] = useState<any>();
  const [dfu, setDfu] = useState<any>();
  const [logs, setLogs] = useState();
  const inset = useSafeAreaInsets();

  const handleConnect = () => {
    setDevices([]);
    setTimeout(() => {
      deviceUtils?.startDeviceScan((_device) => {
        setDevices((prev) => {
          if (
            _device &&
            (_device.name?.startsWith('T') || _device.name?.startsWith('K')) &&
            !prev.find((device) => device.id === _device.id)
          ) {
            return [...prev, _device];
          }
          return prev;
        });
      });
    }, 1000);
  };

  const handleDeviceConnect = async (id: string, device: BleDevice) => {
    set(JSON.stringify({ deviceId: id }));
    setConnectedDevice(null);
    await deviceUtils?.stopScan();
    await deviceUtils?.connect(id, 'classic');
    setConnectedDevice(device);
    setDevices([]);
  };

  const handleFeatures = async () => {
    set('start handleFeatures');
    const features = await onekeyBleConnect.getFeatures(connectedDevice);
    set(JSON.stringify(features));
    setFeatures(features);
  };

  const handlePick = async () => {
    if (platformEnv.isNativeIOS) {
      const url = await DocumentPicker.pick({ type: 'public.archive' });
      setUri(url[0].uri);
    } else if (platformEnv.isNativeAndroid) {
      const firmwareFile = await DocumentPicker.pick({
        type: DocumentPicker.types.zip,
      });
      const destination = RNFS.CachesDirectoryPath + firmwareFile[0].name;

      await RNFS.copyFile(firmwareFile[0].uri, destination);
      setUri(destination);
    }
  };

  const handleDFU = async () => {
    set(
      JSON.stringify({
        deviceAddress: connectedDevice?.id ?? '',
        filePath: uri,
        alternativeAdvertisingNameEnabled: false,
      }),
    );
    try {
      const resp = await NordicDFU.startDFU({
        deviceAddress: connectedDevice?.id ?? '',
        filePath: uri,
        alternativeAdvertisingNameEnabled: false,
      });
      set('NordicDFU.startDFU end', JSON.stringify(resp));
    } catch (e: any) {
      set(e?.message ?? '');
    }
  };

  const copyLog = () => {
    const logs = get();
    setLogs(logs);
    copyToClipboard(logs);
  };

  useEffect(() => {
    DFUEmitter.addListener(
      'DFUProgress',
      ({ percent, currentPart, partsTotal, avgSpeed, speed }) => {
        setProgress({
          percent,
          currentPart,
          partsTotal,
          avgSpeed,
          speed,
        });
      },
    );

    DFUEmitter.addListener('DFUStateChanged', ({ state }) => {
      setDfu(state);
    });
  }, []);

  return (
    <Box bg="background-default" flex="1">
      <ScrollView px={4} py={{ base: 6, md: 8 }} bg="background-default">
        <Box w="full" pb={inset.bottom}>
          <Typography.Body1>1. 连接 Touch</Typography.Body1>
          {devices.map((device) => (
            <Button
              key={device.id}
              onPress={() => handleDeviceConnect(device.id, device)}
            >
              {device.name}
            </Button>
          ))}
          {connectedDevice ? (
            <Typography.Body1>
              已连接：{connectedDevice.name}:{connectedDevice.id}
            </Typography.Body1>
          ) : null}
          <Typography.Body1>2. 确定能够读取设备信息</Typography.Body1>
          {features ? (
            <>
              <Typography.Body2>
                固件: {features.onekey_version}
              </Typography.Body2>
              <Typography.Body2>蓝牙固件: {features.ble_ver}</Typography.Body2>
              <Typography.Body2>
                UUID: {features.onekey_serial}
              </Typography.Body2>
            </>
          ) : null}
          <Typography.Body1>3. 选择蓝牙固件 .zip 结尾</Typography.Body1>
          {uri ? <Typography.Body2>已选择: {uri}</Typography.Body2> : null}
          <Typography.Body1>
            4. 操作 DFU 更新蓝牙固件，注此处仅能通过蓝牙更新蓝牙固件
          </Typography.Body1>
          {progress ? (
            <>
              <Typography.Body2>percent: {progress.percent}</Typography.Body2>
              <Typography.Body2>
                currentPart: {progress.currentPart}
              </Typography.Body2>
              <Typography.Body2>
                partsTotal: {progress.partsTotal}
              </Typography.Body2>
              <Typography.Body2>avgSpeed: {progress.avgSpeed}</Typography.Body2>
              <Typography.Body2>speed: {progress.speed}</Typography.Body2>
            </>
          ) : null}
          {dfu ? (
            <>
              <Typography.Body2>dfu state: {dfu}</Typography.Body2>
            </>
          ) : null}
        </Box>

        <Button onPress={handleConnect}>连接 Touch</Button>
        <Button mt="2" onPress={handleFeatures}>
          读取硬件信息
        </Button>
        <Button mt="2" onPress={handlePick}>
          选择蓝牙固件 .zip
        </Button>
        <Button mt="2" onPress={handleDFU}>
          确认上述无误之后，点击 DFU 更新蓝牙固件
        </Button>

        <Button mt="2" onPress={copyLog} type="primary">
          复制 LOG
        </Button>
        {logs ? <Typography.Body2>{logs}</Typography.Body2> : null}
      </ScrollView>
    </Box>
  );
};

export default DFU;
