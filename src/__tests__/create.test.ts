import { deploy } from '../index';

jest.mock(process.cwd() + '/node_modules/cos-nodejs-sdk-v5', () => {
  return class Client {
    sliceUploadFile (params, callback) {
      callback();
    }
  };
});

jest.mock(process.cwd() + '/node_modules/@faasjs/request', () => {
  return async function (url, params) {
    if (params.body.Action === 'GetFunction') {
      return {
        body: '{"Response":{"Error":"ResourceNotFound.Function"}}'
      };
    }
    return {
      body: '{"Response":{}}'
    };
  };
});

test('create', async function () {
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
});
