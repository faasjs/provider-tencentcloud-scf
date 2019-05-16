import { deploy } from '../index';

describe('config', function () {
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
});
