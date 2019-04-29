## Functions

<dl>
<dt><a href="#action">action(logger, config, params)</a></dt>
<dd><p>发出请求</p>
</dd>
<dt><a href="#deploy">deploy(provider, func)</a></dt>
<dd><p>发布云函数</p>
</dd>
</dl>

<a name="action"></a>

## action(logger, config, params)
发出请求

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| logger | <code>Logger</code> | 日志类实例 |
| config | <code>object</code> | 服务商基本参数 |
| config.region | <code>string</code> | 区域 |
| config.secretId | <code>string</code> | secretId |
| config.secretKey | <code>string</code> | secretKey |
| params | <code>object</code> | 请求参数 |

<a name="deploy"></a>

## deploy(provider, func)
发布云函数

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| provider | <code>object</code> | 服务商配置 |
| func | <code>object</code> | 云函数配置 |

