import { deepMerge, Logger, request } from '@faasjs/utils';
import { execSync } from 'child_process';
import * as crypto from 'crypto';

function mergeData(data: any, prefix: string = '') {
  const ret: any = {};
  for (const k in data) {
    if (data[k] === null) {
      continue;
    }
    if (data[k] instanceof Array || data[k] instanceof Object) {
      Object.assign(ret, mergeData(data[k], prefix + k + '.'));
    } else {
      ret[prefix + k] = data[k];
    }
  }
  return ret;
}

function formatSignString(params: any) {
  const str: string[] = [];

  for (const key of Object.keys(params).sort()) {
    str.push(key + '=' + params[key]);
  }

  return str.join('&');
}

const cosUploadFile = function (SecretId: string, SecretKey: string, params: any) {
  const cosSdk = require('cos-nodejs-sdk-v5');
  const client = new cosSdk({
    SecretId,
    SecretKey,
  });

  return new Promise((resolve, reject) => {
    client.sliceUploadFile(params, function (err: any, data: any) {
      if (err) { reject(err); }
      resolve(data);
    });
  });
};

const action = function (logger: Logger, config: any, params: any) {
  logger.debug('%o', params);

  params = Object.assign({
    Nonce: Math.round(Math.random() * 65535),
    Region: config.region,
    SecretId: config.secretId,
    SignatureMethod: 'HmacSHA256',
    Timestamp: Math.round(Date.now() / 1000) - 1,
    Version: '2018-04-16',
  }, params);
  params = mergeData(params);

  const sign = 'POSTscf.tencentcloudapi.com/?' + formatSignString(params);

  params.Signature = crypto.createHmac('sha256', config.secretKey).update(sign).digest('base64');

  return request('https://scf.tencentcloudapi.com/?', {
    body: params,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  }).then(function (res) {
    const body = JSON.parse(res.body);
    if (body.Response.Error) {
      throw Error(JSON.stringify(body.Response.Error));
    } else {
      return body.Response;
    }
  });
};

const formatEnvironment = function (env: any) {
  if (!env || env.Variables) { return env; }
  const Variables: any = [];
  Object.keys(env).forEach(function (k) {
    Variables.push({
      Key: k,
      Value: env[k],
    });
  });
  return { Variables };
};

/**
 * 发布云函数
 * @param provider {object} 服务商配置
 * @param func {object} 云函数配置
 */
const deploy = async function (provider: any, func: any) {
  const logger = new Logger('@faasjs/tencentcloud-faas:deploy:' + func.name);

  logger.debug('开始发布\n\nprovider:\n%o\n\nfunc:\n%o', provider, func);

  const config: {
    appId: string;
    region: string;
    secretId: string;
    secretKey: string;
  } = {
    appId: provider.config.appId,
    region: provider.config.region,
    secretId: provider.config.secretId,
    secretKey: provider.config.secretKey,
  };

  for (const key of ['appId', 'region', 'secretId', 'secretKey']) {
    if (!config[key]) {
      throw Error(`${key} required`);
    }
  }

  logger.debug('打包源代码');
  execSync(`cd ${func.tmpFolder} && zip -r deploy.zip *`);
  func.deployFilename = func.name + '/' + func.packageJSON.version + '.zip';

  logger.debug('上传代码包');
  await cosUploadFile(config.secretId, config.secretKey, {
    Bucket: `scf-${config.appId}`,
    FilePath: func.tmpFolder + '/deploy.zip',
    Key: func.deployFilename,
    Region: config.region,
  });

  logger.debug('检查云函数是否已存在');
  try {
    await action(logger, config, {
      Action: 'GetFunction',
      FunctionName: func.name,
    });

    logger.debug('更新云函数代码');

    await action(logger, config, {
      Action: 'UpdateFunctionCode',
      CosBucketName: 'scf',
      CosBucketRegion: config.region,
      CosObjectName: func.deployFilename,
      FunctionName: func.name,
      Handler: func.resource.config.Handler,
      Region: provider.config.region,
    });

    logger.debug('更新云函数设置');

    await action(logger, config, {
      Action: 'UpdateFunctionConfiguration',
      Environment: formatEnvironment(func.resource.config.Environment),
      FunctionName: func.name,
      MemorySize: func.resource.config.MemorySize,
      Timeout: func.resource.config.Timeout,
      VpcConfig: func.resource.config.VpcConfig,
    });
  } catch (error) {
    if (error.message.includes('ResourceNotFound.Function')) {
      logger.debug('创建云函数');

      const params = deepMerge({
        Action: 'CreateFunction',
        Code: {
          CosBucketName: 'scf',
          CosBucketRegion: config.region,
          CosObjectName: func.deployFilename,
        },
        FunctionName: func.name,
      }, func.resource.config);

      params.Environment = formatEnvironment(params.Environment);

      await action(logger, config, params);
    } else {
      throw error;
    }
  }

  return true;
};

export {
  deploy,
};
