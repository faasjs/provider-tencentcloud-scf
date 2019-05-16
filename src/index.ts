import deepMerge from '@faasjs/deep_merge';
import request from '@faasjs/request';
import Logger from '@faasjs/logger';
import { execSync } from 'child_process';
import * as crypto from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cosSdk = require('cos-nodejs-sdk-v5');

function mergeData (data: any, prefix: string = '') {
  const ret: any = {};
  for (const k in data) {
    if (typeof data[k as string] === 'undefined' || data[k as string] === null) {
      continue;
    }
    if (data[k as string] instanceof Array || data[k as string] instanceof Object) {
      Object.assign(ret, mergeData(data[k as string], prefix + k + '.'));
    } else {
      ret[prefix + k] = data[k as string];
    }
  }
  return ret;
}

function formatSignString (params: any) {
  const str: string[] = [];

  for (const key of Object.keys(params).sort()) {
    str.push(key + '=' + params[key as string]);
  }

  return str.join('&');
}

const cosUploadFile = function (SecretId: string, SecretKey: string, params: any) {
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

/**
 * 发出请求
 *
 * @param logger {Logger} 日志类实例
 * @param config {object} 服务商基本参数
 * @param config.region {string} 区域
 * @param config.secretId {string} secretId
 * @param config.secretKey {string} secretKey
 * @param params {object} 请求参数
 */
const action = function (logger: Logger, config: any, params: any) {
  logger.debug('%o', params);

  params = Object.assign({
    Nonce: Math.round(Math.random() * 65535),
    Region: params.Region || config.region,
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

const formatEnvironment = function (env: any, extra: any) {
  let Variables: any[] = [];

  if (env && env.Variables) {
    Variables = env.Variables;
  } else if (env) {
    Object.keys(env).forEach(function (k) {
      Variables.push({
        Key: k,
        Value: env[k as string],
      });
    });
  }

  for (const key in extra) {
    if (extra.hasOwnProperty(key)) {
      Variables.push({
        Key: key,
        Value: extra[key as string],
      });
    }
  }

  return { Variables };
};

/**
 * 发布云函数
 * @param staging {string} 部署环境
 * @param func {object} 部署配置
 */
const deploy = async function (staging: string, func: any) {
  const logger = new Logger('@faasjs/tencentcloud-faas:deploy:' + func.name);

  logger.debug('开始发布\n\nstaging:\n%s\n\nfunc:\n%o', staging, func);

  const config: {
    appId: string;
    region: string;
    secretId: string;
    secretKey: string;
  } = {
    appId: func.resource.provider.config.appId,
    region: func.resource.provider.config.region,
    secretId: func.resource.provider.config.secretId,
    secretKey: func.resource.provider.config.secretKey,
  };

  for (const key of ['appId', 'region', 'secretId', 'secretKey']) {
    if (!config[key as string]) {
      throw Error(`${key} required`);
    }
  }

  // 转换函数名
  const FunctionName = func.name.replace(/[^a-zA-Z0-9-_]/g, '_');

  // 处理环境变量
  func.resource.config.Environment = formatEnvironment(func.resource.config.Environment, {
    FaasMode: 'remote',
    FaasEnv: staging,
    FaasName: func.name
  });

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
      FunctionName,
      Namespace: staging,
    });

    logger.debug('更新云函数代码');

    await action(logger, config, {
      Action: 'UpdateFunctionCode',
      CosBucketName: 'scf',
      CosBucketRegion: config.region,
      CosObjectName: func.deployFilename,
      FunctionName,
      Handler: func.resource.config.Handler,
      Namespace: staging,
    });

    logger.debug('更新云函数设置');

    await action(logger, config, {
      Action: 'UpdateFunctionConfiguration',
      Environment: func.resource.config.Environment,
      FunctionName,
      MemorySize: func.resource.config.MemorySize,
      Timeout: func.resource.config.Timeout,
      VpcConfig: func.resource.config.VpcConfig,
      Namespace: staging,
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
        FunctionName,
        Namespace: staging,
      }, func.resource.config);

      await action(logger, config, params);
    } else {
      throw error;
    }
  }

  logger.debug('发布版本');
  const res = await action(logger, config, {
    Action: 'PublishVersion',
    Description: `Published by ${process.env.LOGNAME}`,
    FunctionName,
    Namespace: staging
  });

  func.functionName = FunctionName;
  func.version = res.FunctionVersion;

  return true;
};

export {
  action,
  deploy,
};
