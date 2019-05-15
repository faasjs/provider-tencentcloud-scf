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
  const func = {
    name: 'name',
    resource: {
      config: {
        Handler: 'index.handler',
        MemorySize: 128,
        Timeout: 15,
        Runtime: 'Nodejs8.9'
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
  };
  const res = await deploy('testing', func);

  expect(res).toBeTruthy();
  expect(func.resource.config.Environment.Variables[0]).toEqual({
    Key: 'FaasMode',
    Value: 'remote'
  });
  expect(func.resource.config.Environment.Variables[1]).toEqual({
    Key: 'FaasEnv',
    Value: 'testing'
  });
  expect(func.resource.config.Environment.Variables[2]).toEqual({
    Key: 'FaasName',
    Value: 'name'
  });
});
