import { deploy } from '../index';

jest.mock(process.cwd() + '/node_modules/cos-nodejs-sdk-v5', () => {
  return class Client {
    sliceUploadFile (params, callback) {
      callback();
    }
  };
});

jest.mock(process.cwd() + '/node_modules/@faasjs/request', () => {
  return async function () {
    return {
      body: '{"Response":{}}'
    };
  };
});

test.each(['region', 'secretId', 'secretKey'])('%s', async function (key) {
  try {
    await deploy('testing', {
      resource: {
        provider: {
          config: {
            [key]: key
          },
          type: 'tencentcloud',
        }
      },
    });
  } catch (error) {
    expect(error.message).toEqual('appId required');
  }
});

test('should work', async function () {
  const res = await deploy('testing', {
    name: 'testing',
    resource: {
      config: {
        Handler: 'index.handler',
        MemorySize: 128,
        Timeout: 15,
        Runtime: 'Nodejs8.9',
        Environment: {
          Key: 'Value'
        }
      },
      provider: {
        config: {
          appId: 'appId',
          region: 'ap-beijing',
          secretId: 'secretId',
          secretKey: 'secretKey',
        },
        type: 'tencentcloud',
      }
    },
    packageJSON: {
      version: '0.0.0',
    },
    tmpFolder: process.cwd() + '/src/__tests__/mock',
  });

  expect(res).toBeTruthy();
});
