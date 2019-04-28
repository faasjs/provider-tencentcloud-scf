import { deploy } from '../index';

test.each(['region', 'secretId', 'secretKey'])('%s', async function (key) {
  try {
    await deploy({
      config: {
        [key]: key,
      },
      type: 'tencentcloud',
    }, {});
  } catch (error) {
    expect(error.message).toEqual('appId required');
  }
});

test('should work', async function () {
  try {
    await deploy({
      config: {
        appId: 'appId',
        region: 'ap-beijing',
        secretId: 'secretId',
        secretKey: 'secretKey',
      },
      type: 'tencentcloud',
    }, {
        packageJSON: {
          version: '0.0.0',
        },
        tmpFolder: process.cwd() + '/src/__tests__/mock',
      });
  } catch (error) {
    expect(error.error).toContain('Bucket should format');
  }
});
